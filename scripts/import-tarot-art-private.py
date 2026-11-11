#!/usr/bin/env python3
"""Offline, fail-closed ZIP admission. Author content stays OUTSIDE the repository.

Manifest default: {"cards": [{"card_id": "major-00", "file": "cards/00.png"}, ...]}.
Use --path-field for a differently named legacy path property; never infer card IDs.
--manifest imports optimized cards/*.jpg from one or more independent ZIPs, using
telegram_image / telegram_image_sha256. source_* PNG references are not inputs.
This script reads DATA only; it does not execute instructions in the archive.
"""
import argparse
from contextlib import ExitStack
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import stat
import tempfile
import warnings
import zipfile
from PIL import Image, ImageOps

REPO = Path(__file__).resolve().parent.parent
Image.MAX_IMAGE_PIXELS = 40000000


def require(ok, code):
    if not ok:
        raise ValueError(code)


def relative(name):
    require(isinstance(name, str) and name and '\\' not in name and '\x00' not in name, 'UNSAFE_PATH')
    p = PurePosixPath(name)
    require(not p.is_absolute() and all(x not in ('', '.', '..') for x in name.split('/')) and ':' not in name, 'UNSAFE_PATH')
    return p


def private_root(out):
    require(out.is_absolute() and out.parent.is_dir() and out.parent.resolve() == out.parent and not out.exists(), 'OUTPUT_MUST_BE_NEW_ABSOLUTE')
    require(out != REPO and REPO not in out.parents, 'OUTPUT_MUST_BE_OUTSIDE_GIT')
    require(not any(git_root(p) for p in out.parents), 'OUTPUT_MUST_BE_OUTSIDE_ANY_GIT')


def git_root(folder):
    marker = folder / '.git'
    # Managed sandboxes can mount empty read-only .git placeholders in /tmp.
    # A real repository needs HEAD; a gitfile denotes an external worktree.
    return marker.is_file() or (marker.is_dir() and (marker / 'HEAD').exists())


def private_input(file):
    require(file.is_file() and file.resolve() == file.absolute(), 'INPUT_MUST_BE_REGULAR')
    require(not file.is_symlink() and file.stat().st_nlink == 1, 'UNSAFE_INPUT')
    require(not any(git_root(p) for p in file.parents), 'INPUT_MUST_BE_OUTSIDE_GIT')


def strict_json(data):
    def pairs(items):
        result = {}
        for key, value in items:
            require(key not in result, 'DUPLICATE_JSON_KEY')
            result[key] = value
        return result
    return json.loads(data, object_pairs_hook=pairs)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--local-only', action='store_true', required=True)
    p.add_argument('--archive', type=Path, action='append', required=True)
    p.add_argument('--manifest', type=Path, help='Separate optimized-JPEG manifest; source PNGs are not required')
    p.add_argument('--output', type=Path, required=True)
    p.add_argument('--manifest-entry', default='manifest.json')
    p.add_argument('--records-field', default='cards')
    p.add_argument('--path-field', default='file')
    p.add_argument('--art-version')
    a = p.parse_args()
    private_root(a.output)
    require(len(a.archive) <= 8 and len(set(a.archive)) == len(a.archive), 'ARCHIVE_COUNT_OR_DUPLICATE')
    for archive in a.archive:
        private_input(archive)
    optimized = a.manifest is not None
    if optimized:
        private_input(a.manifest)
        require(a.manifest.stat().st_size <= 1024 * 1024, 'MANIFEST_TOO_LARGE')
    names = {r['card_id']: r['name_ru'] for r in json.loads((REPO / 'data/tarot25-art-contract07.json').read_text())}
    relative(a.manifest_entry)
    # TemporaryDirectory is 0700; on any failure no partial final deck is admitted.
    with ExitStack() as stack, tempfile.TemporaryDirectory(prefix='.astra-art-', dir=a.output.parent) as work:
        entries = {}
        count, total_bytes = 0, 0
        for archive in a.archive:
            z = stack.enter_context(zipfile.ZipFile(archive))
            for i in z.infolist():
                count += 1; total_bytes += i.file_size
                require(count <= 512 and total_bytes <= 1024 * 1024 * 1024, 'ARCHIVE_SIZE_LIMIT')
                relative(i.filename.rstrip('/') if i.is_dir() else i.filename)
                mode = i.external_attr >> 16
                require(not stat.S_ISLNK(mode) and not i.flag_bits & 1, 'UNSAFE_ZIP_MEMBER')
                require(i.filename not in entries and i.file_size <= 64 * 1024 * 1024, 'DUPLICATE_OR_LARGE_MEMBER')
                require(not mode or stat.S_IFMT(mode) in (0, stat.S_IFREG, stat.S_IFDIR), 'SPECIAL_ZIP_MEMBER')
                # Directory markers are not image records; duplicates across standalone ZIPs are harmless.
                if not i.is_dir():
                    entries[i.filename] = (z, i)
        if optimized:
            raw_manifest = a.manifest.read_bytes()
        else:
            require(a.manifest_entry in entries and entries[a.manifest_entry][1].file_size <= 1024 * 1024, 'MANIFEST_MISSING_OR_LARGE')
            z, info = entries[a.manifest_entry]
            raw_manifest = z.read(info)
        manifest = strict_json(raw_manifest)
        if optimized:
            require(isinstance(manifest, dict) and manifest.get('manifest_version') == 'astra-author-art-assets-v1'
                    and manifest.get('deck_version') == 'rws78-v1' and manifest.get('card_count') == 78, 'OPTIMIZED_MANIFEST_VERSION')
            require(a.art_version is None or a.art_version == manifest.get('art_version'), 'ART_VERSION_MISMATCH')
            a.art_version = manifest.get('art_version')
        require(isinstance(a.art_version, str) and 0 < len(a.art_version) <= 80
                and all(c.isascii() and (c.isalnum() or c in '._-') for c in a.art_version), 'ART_VERSION')
        cards = manifest if isinstance(manifest, list) else manifest.get(a.records_field)
        require(isinstance(cards, list) and len(cards) == 78, 'EXACTLY_78_CARDS_REQUIRED')
        require(all(isinstance(c, dict) and isinstance(c.get('card_id'), str) for c in cards), 'CARD_ID_REQUIRED')
        require(len({c['card_id'] for c in cards}) == 78 and {c['card_id'] for c in cards} == set(names), 'CANONICAL_ID_MISMATCH_NO_AUTOMATIC_RENAMING')
        base = PurePosixPath('.') if optimized else PurePosixPath(a.manifest_entry).parent
        paths = []
        for c in cards:
            path = str(base / relative(c.get('telegram_image' if optimized else a.path_field)))
            require(path in entries, 'MISSING_CARD_IMAGE')
            require(c.get('name_ru', names[c['card_id']]) == names[c['card_id']], 'CARD_TITLE_MISMATCH')
            if optimized:
                require(path == 'cards/' + c['card_id'] + '.jpg' and c.get('asset_id') == 'rws78-v1/' + c['card_id'], 'OPTIMIZED_CARD_PATH_OR_ASSET')
                require(c.get('upright_rotation') == 0 and c.get('reversed_rotation') == 180, 'OPTIMIZED_ORIENTATION')
                declared = c.get('telegram_image_sha256')
                require(isinstance(declared, str) and len(declared) == 64 and all(x in '0123456789abcdef' for x in declared), 'OPTIMIZED_HASH_REQUIRED')
            paths.append(path)
        require(len(set(paths)) == 78, 'SHARED_ORIGINAL_FILE')
        if optimized:
            require(set(entries) == set(paths), 'UNEXPECTED_OPTIMIZED_ARCHIVE_FILE')
        root = Path(work)
        originals, derivatives = root / ('inputs' if optimized else 'originals'), root / 'derivatives'
        originals.mkdir(mode=0o700); derivatives.mkdir(mode=0o700)
        result, content_hashes = [], set()
        for c, path in zip(cards, paths):
            z, info = entries[path]
            data = z.read(info)
            sha = hashlib.sha256(data).hexdigest()
            require(sha not in content_hashes, 'DUPLICATE_ORIGINAL_BYTES')
            content_hashes.add(sha)
            require(c.get('telegram_image_sha256' if optimized else 'sha256', sha) == sha, 'IMAGE_HASH_MISMATCH')
            with warnings.catch_warnings():
                warnings.simplefilter('error', Image.DecompressionBombWarning)
                with Image.open(io.BytesIO(data)) as src:
                    require(src.format in ('PNG', 'JPEG', 'WEBP') and not getattr(src, 'is_animated', False), 'UNSUPPORTED_IMAGE')
                    require(src.width * src.height <= 40000000 and src.width > 0 and src.height > 0, 'PIXEL_LIMIT')
                    require(max(src.width, src.height) / min(src.width, src.height) <= 20, 'TELEGRAM_PHOTO_ASPECT_RATIO')
                    require('exif' not in src.info or isinstance(src.info['exif'], bytes), 'EXIF_INVALID')
                    if optimized:
                        require(src.format == 'JPEG' and list(src.size) == c.get('telegram_image_dimensions'), 'OPTIMIZED_IMAGE_DIMENSIONS_OR_FORMAT')
                    copy_upright = optimized and src.width <= 1024 and src.height <= 1536 and not src.getexif() and not src.info.get('icc_profile') and not src.info.get('comment')
                    ext = {'PNG': '.png', 'JPEG': '.jpg', 'WEBP': '.webp'}[src.format]
                    # EXIF orientation changes only derivative pixels; original bytes stay exact.
                    image = ImageOps.exif_transpose(src).convert('RGBA')
                    bg = Image.new('RGBA', image.size, 'white'); bg.alpha_composite(image)
                    image = bg.convert('RGB'); image.thumbnail((1024, 1536))
                    generated = {}
                    for rev, suffix in ((False, 'upright'), (True, 'reversed')):
                        dest = derivatives / (c['card_id'] + '-' + suffix + '.jpg')
                        if not rev and copy_upright:
                            dest.write_bytes(data)
                        elif optimized:
                            # Preserve fine lettering/facial detail through the second JPEG encoding.
                            (image.transpose(Image.Transpose.ROTATE_180) if rev else image).save(dest, quality=95, subsampling=0, optimize=True)
                        else:
                            (image.transpose(Image.Transpose.ROTATE_180) if rev else image).save(dest, quality=90, optimize=True)
                        require(dest.stat().st_size < 10 * 1024 * 1024, 'TELEGRAM_PHOTO_SIZE')
                        os.chmod(dest, 0o600)
                        generated['telegram_' + suffix] = dest.name
                        generated['sha256_' + suffix] = hashlib.sha256(dest.read_bytes()).hexdigest()
            original = originals / (c['card_id'] + ext)
            original.write_bytes(data); os.chmod(original, 0o600)
            result.append({'card_id': c['card_id'], 'name_ru': names[c['card_id']], 'source_entry': path,
                           'asset_id': 'rws78-v1/' + c['card_id'], 'original': originals.name + '/' + original.name,
                           'sha256': sha, 'upright_rotation': 0, 'reversed_rotation': 180, **generated})
        private = {'manifest_version': 'astra-art-manifest-v1', 'deck_version': 'rws78-v1', 'art_version': a.art_version,
                   'input_kind': 'telegram_jpeg' if optimized else 'legacy_originals', 'archive_count': len(a.archive),
                   'source_pngs_required': False if optimized else None,
                   'source_manifest_sha256': hashlib.sha256(raw_manifest).hexdigest(), 'private_originals_in_git': False, 'cards': result}
        for name, data in [('source-manifest.json', raw_manifest), ('manifest.json', json.dumps(private, ensure_ascii=False, indent=2).encode())]:
            target = root / name; target.write_bytes(data); os.chmod(target, 0o600)
        # Never overwrite even an empty pre-existing destination.
        a.output.mkdir(mode=0o700)
        try:
            for child in root.iterdir():
                shutil.move(str(child), a.output / child.name)
        except BaseException:
            shutil.rmtree(a.output)
            raise
    print(json.dumps({'local_only': True, 'cards': 78, 'derivatives': 156, 'original_bytes_preserved': True,
                      'input_kind': private['input_kind'], 'source_pngs_required': private['source_pngs_required'],
                      'uploads': 0, 'source_manifest_sha256': private['source_manifest_sha256']}))


if __name__ == '__main__':
    try:
        main()
    except (ValueError, KeyError, TypeError, OSError, zipfile.BadZipFile, Image.UnidentifiedImageError):
        # Do not leak owner filenames or embedded metadata into public build logs.
        raise SystemExit('STOP: private archive validation failed; no completed deck admitted')
