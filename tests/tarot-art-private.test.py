"""No portraits: tiny asymmetric synthetic pixel fixtures only, temporary private ZIPs."""
import hashlib
import io
import json
from pathlib import Path
import stat
import subprocess
import tempfile
import unittest
import zipfile
from PIL import Image, ImageChops

REPO = Path(__file__).resolve().parent.parent
NAMES = json.loads((REPO / 'data/tarot25-art-contract07.json').read_text())


class PrivateArchive(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='astra-private-art-test-')
        self.root = Path(self.temp.name)
        self.entries, self.cards = {}, []
        for n, c in enumerate(reversed(NAMES)):
            image = Image.new('RGB', (48, 72), (n * 3 % 256, n * 7 % 256, 120))
            for x in range(16):
                for y in range(20):
                    image.putpixel((x, y), (255, 0, n))
            b = io.BytesIO(); image.save(b, format='PNG')
            name = 'images/' + c['card_id'] + '.png'
            self.entries[name] = b.getvalue()
            self.cards.append({**c, 'file': name, 'sha256': hashlib.sha256(b.getvalue()).hexdigest()})

    def tearDown(self):
        self.temp.cleanup()

    def run_cli(self, *, mutate=lambda cards: None, extra=None, output=None, manifest_entry='manifest.json'):
        mutate(self.cards)
        archive = self.root / 'source.zip'
        with zipfile.ZipFile(archive, 'w') as z:
            for name, data in self.entries.items():
                z.writestr(name, data)
            z.writestr(manifest_entry, json.dumps({'cards': self.cards}))
            if extra:
                extra(z)
        before = hashlib.sha256(archive.read_bytes()).hexdigest()
        out = output or self.root / 'prepared'
        result = subprocess.run(['python3', 'scripts/import-tarot-art-private.py', '--local-only',
                                 '--archive', str(archive), '--output', str(out), '--art-version', 'SYNTHETIC-ONLY',
                                 '--manifest-entry', manifest_entry], cwd=REPO, capture_output=True, text=True)
        self.assertEqual(hashlib.sha256(archive.read_bytes()).hexdigest(), before)
        self.assertEqual(list(self.root.glob('.astra-art-*')), [])
        return result, out

    def rejected(self, **kwargs):
        result, out = self.run_cli(**kwargs)
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(out.exists())

    def test_complete_shuffled_deck_preserves_ids_original_bytes_rotates_and_strips_metadata(self):
        r, out = self.run_cli()
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(json.loads(r.stdout)['derivatives'], 156)
        self.assertEqual(stat.S_IMODE(out.stat().st_mode), 0o700)
        m = json.loads((out / 'manifest.json').read_text())
        self.assertEqual(len(m['cards']), 78)
        self.assertEqual([c['card_id'] for c in m['cards']], [c['card_id'] for c in self.cards])
        for c in m['cards']:
            self.assertEqual((out / c['original']).read_bytes(), self.entries[c['source_entry']])
            upright = out / 'derivatives' / c['telegram_upright']
            reversed_ = out / 'derivatives' / c['telegram_reversed']
            self.assertEqual(stat.S_IMODE(reversed_.stat().st_mode), 0o600)
            with Image.open(upright) as a, Image.open(reversed_) as b:
                self.assertFalse(b.getexif())
                difference = ImageChops.difference(a.transpose(Image.Transpose.ROTATE_180), b)
                self.assertLess(max(max(v) for v in difference.getdata()), 35)

    def test_duplicate_id(self):
        self.rejected(mutate=lambda c: c.__setitem__(0, c[1]))

    def test_unknown_id_never_renamed(self):
        self.rejected(mutate=lambda c: c[0].update(card_id='The_Fool'))

    def test_wrong_declared_hash(self):
        self.rejected(mutate=lambda c: c[0].update(sha256='0' * 64))

    def test_missing_card(self):
        self.rejected(mutate=lambda c: c.pop())

    def test_unsafe_even_unreferenced_path(self):
        self.rejected(extra=lambda z: z.writestr('../face.png', b'bad'))

    def test_symlink(self):
        def add(z):
            info = zipfile.ZipInfo('link.png'); info.create_system = 3
            info.external_attr = (stat.S_IFLNK | 0o777) << 16
            z.writestr(info, '/etc/passwd')
        self.rejected(extra=add)

    def test_shared_original(self):
        self.rejected(mutate=lambda c: c[0].update(file=c[1]['file']))

    def test_false_title(self):
        self.rejected(mutate=lambda c: c[0].update(name_ru='Ложная карта'))

    def test_corrupted_image(self):
        self.entries[self.cards[0]['file']] = b'not a picture'
        self.cards[0].pop('sha256')
        self.rejected()

    def test_output_in_git(self):
        self.rejected(output=REPO / 'private-forbidden-test-output')

    def test_preexisting_output_never_overwritten(self):
        out = self.root / 'prepared'; out.mkdir(); (out / 'keep').write_bytes(b'unchanged')
        r, _ = self.run_cli(output=out)
        self.assertNotEqual(r.returncode, 0)
        self.assertEqual((out / 'keep').read_bytes(), b'unchanged')

    def test_other_git_repository(self):
        other = self.root / 'other'; other.mkdir(); (other / '.git').mkdir(); (other / '.git' / 'HEAD').write_text('ref: refs/heads/main\n')
        self.rejected(output=other / 'portraits')

    def test_exif_orientation_private_derivatives_only(self):
        source = Image.new('RGB', (30, 60), 'blue')
        exif = Image.Exif(); exif[274] = 6; exif[315] = 'PRIVATE METADATA MUST NOT LEAK'
        buffer = io.BytesIO(); source.save(buffer, format='JPEG', exif=exif)
        key = self.cards[0]['file']; self.entries[key] = buffer.getvalue(); self.cards[0].pop('sha256')
        r, out = self.run_cli()
        self.assertEqual(r.returncode, 0, r.stderr)
        record = json.loads((out / 'manifest.json').read_text())['cards'][0]
        with Image.open(out / 'derivatives' / record['telegram_upright']) as derivative:
            self.assertEqual(derivative.size, (60, 30)); self.assertFalse(derivative.getexif())
        self.assertEqual((out / record['original']).read_bytes(), buffer.getvalue())


class OptimizedParts(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='astra-optimized-parts-test-')
        self.root = Path(self.temp.name)
        self.files, self.cards = {}, []
        for n, c in enumerate(reversed(NAMES)):
            image = Image.new('RGB', (48, 72), (n * 3 % 256, n * 7 % 256, 120))
            for x in range(12):
                for y in range(20):
                    image.putpixel((x, y), (220, 10, n))
            b = io.BytesIO(); image.save(b, format='JPEG', quality=90)
            name = 'cards/' + c['card_id'] + '.jpg'
            self.files[name] = b.getvalue()
            # The unavailable original PNG hash must NEVER be compared with JPEG bytes.
            self.cards.append({'card_id': c['card_id'], 'asset_id': 'rws78-v1/' + c['card_id'],
                               'source_name': 'NOT_SUPPLIED/' + c['card_id'] + '.png', 'source_sha256': 'f' * 64,
                               'telegram_image': name, 'telegram_image_sha256': hashlib.sha256(b.getvalue()).hexdigest(),
                               'telegram_image_dimensions': [48, 72], 'upright_rotation': 0, 'reversed_rotation': 180})

    def tearDown(self):
        self.temp.cleanup()

    def run_cli(self, *, change=lambda m: None, duplicate=False, extra=None):
        manifest = {'manifest_version': 'astra-author-art-assets-v1', 'deck_version': 'rws78-v1',
                    'art_version': 'SYNTHETIC-OPTIMIZED', 'card_count': 78, 'source_originals_included': False,
                    'cards': self.cards}
        change(manifest)
        raw = json.dumps(manifest).encode()
        m = self.root / 'manifest.json'; m.write_bytes(raw)
        files = list(self.files.items()); parts = []
        for part, selection in enumerate((files[:39], files[39:])):
            dest = self.root / ('part-' + str(part) + '.zip')
            with zipfile.ZipFile(dest, 'w') as z:
                z.writestr('cards/', b'')
                for name, data in selection:
                    z.writestr(name, data)
                if part == 1 and duplicate:
                    z.writestr(*files[0])
                if part == 1 and extra:
                    z.writestr(*extra)
            parts.append(dest)
        hashes = [hashlib.sha256(p.read_bytes()).hexdigest() for p in [m] + parts]
        out = self.root / 'ready'
        args = ['python3', 'scripts/import-tarot-art-private.py', '--local-only', '--manifest', str(m), '--output', str(out)]
        for part in reversed(parts):  # Part order cannot change the canonical mapping.
            args += ['--archive', str(part)]
        result = subprocess.run(args, cwd=REPO, capture_output=True, text=True)
        self.assertEqual([hashlib.sha256(p.read_bytes()).hexdigest() for p in [m] + parts], hashes)
        self.assertEqual(list(self.root.glob('.astra-art-*')), [])
        return result, out, raw

    def rejected(self, **kwargs):
        r, out, _ = self.run_cli(**kwargs)
        self.assertNotEqual(r.returncode, 0); self.assertFalse(out.exists())

    def test_two_standalone_parts_no_png_needed_upright_bytes_and_private_manifest_preserved(self):
        r, out, raw = self.run_cli()
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(json.loads(r.stdout)['cards'], 78)
        private = json.loads((out / 'manifest.json').read_text())
        self.assertFalse(private['source_pngs_required']); self.assertEqual(private['archive_count'], 2)
        self.assertEqual((out / 'source-manifest.json').read_bytes(), raw)
        for c in private['cards']:
            source = self.files[c['source_entry']]
            self.assertEqual((out / c['original']).read_bytes(), source)
            upright = out / 'derivatives' / c['telegram_upright']
            reversed_ = out / 'derivatives' / c['telegram_reversed']
            self.assertEqual(upright.read_bytes(), source)
            with Image.open(upright) as a, Image.open(reversed_) as b:
                diff = ImageChops.difference(a.transpose(Image.Transpose.ROTATE_180), b)
                self.assertLess(max(max(v) for v in diff.getdata()), 35)
            self.assertEqual(stat.S_IMODE(upright.stat().st_mode), 0o600)

    def test_duplicate_between_parts(self):
        self.rejected(duplicate=True)

    def test_authoritative_jpeg_hash_not_source_png_hash(self):
        self.rejected(change=lambda m: m['cards'][0].update(telegram_image_sha256='0' * 64))

    def test_jpeg_hash_required(self):
        self.rejected(change=lambda m: m['cards'][0].pop('telegram_image_sha256'))

    def test_wrong_jpeg_dimensions(self):
        self.rejected(change=lambda m: m['cards'][0].update(telegram_image_dimensions=[960, 1357]))

    def test_manifest_file_path_must_match_exact_id(self):
        self.rejected(change=lambda m: m['cards'][0].update(telegram_image=m['cards'][1]['telegram_image']))

    def test_missing_card(self):
        self.files.pop(self.cards[0]['telegram_image']); self.rejected()

    def test_unexpected_file_never_executed(self):
        self.rejected(extra=('RUN_ME.sh', b'exit 0'))

    def test_unsafe_member_in_second_part(self):
        self.rejected(extra=('../outside.jpg', b'bad'))

    def test_wrong_deck(self):
        self.rejected(change=lambda m: m.update(deck_version='different-deck'))


if __name__ == '__main__':
    unittest.main()
