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


if __name__ == '__main__':
    unittest.main()
