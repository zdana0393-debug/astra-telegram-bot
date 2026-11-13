"""Actual offline Node assembly; only synthetic file IDs and temporary private files."""
import json
import hashlib
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'tools/tarot-bulk-loader'))
from release_build import inspect_registry,build_private_release,clean_env,protect_release_folder
from bulk_core import Stop,save_json


class ReleaseBuild(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='astra-release-build-');self.root=Path(self.temp.name)
        names=json.loads((ROOT/'data/tarot25-art-contract07.json').read_text())
        self.registry={'version':'astra-telegram-art-v1','deck_version':'rws78-v1','art_version':'SYNTHETIC',
                       'source_manifest_sha256':'0'*64,'bot_id':123456789,'realm':'production',
                       'cards':[{'card_id':c['card_id'],**{m:{'file_id':'SYNTHETIC_'+c['card_id']+'_'+m} for m in ('upright','reversed')}} for c in names]}
        self.file=self.root/'telegram-registry.json';save_json(self.file,self.registry)
    def tearDown(self):self.temp.cleanup()
    def write(self):save_json(self.file,self.registry)
    def test_actual_worker_is_private_no_api_and_receipt_has_no_ids(self):
        with patch.dict('os.environ',{'ASTRA_PILOT_BOT_TOKEN':'DO_NOT_PASS_TO_NODE'}):
            self.assertNotIn('ASTRA_PILOT_BOT_TOKEN',clean_env())
            folder,receipt=build_private_release(self.file,self.root/'release')
        worker=folder/'ASTRA_2_5_WORKER.js'
        self.assertEqual(hashlib.sha256(worker.read_bytes()).hexdigest(),receipt['worker_sha256'])
        self.assertIn(b'SYNTHETIC_major-00_upright',worker.read_bytes())
        self.assertFalse(receipt['deployed']);self.assertFalse(receipt['public_ready'])
        self.assertEqual(receipt['images'],156);self.assertNotIn(str(self.registry['bot_id']),json.dumps(receipt))
        self.assertNotIn('SYNTHETIC_major',json.dumps(receipt));self.assertNotIn('DO_NOT_PASS_TO_NODE',worker.read_text())
        self.assertEqual(inspect_registry(folder/'telegram-registry.json'),self.registry)
        if sys.platform!='win32':self.assertEqual(worker.stat().st_mode&0o777,0o600)
    def test_missing_image_blocks_before_build(self):
        del self.registry['cards'][0]['reversed'];self.write()
        with self.assertRaises(Stop):build_private_release(self.file,self.root/'output')
        self.assertFalse((self.root/'output').exists())
    def test_duplicate_ids_block(self):
        self.registry['cards'][1]['upright']=self.registry['cards'][0]['upright'];self.write()
        with self.assertRaises(Stop):inspect_registry(self.file)
    def test_wrong_realm_blocks(self):
        self.registry['realm']='test';self.write()
        with self.assertRaises(Stop):inspect_registry(self.file)
    def test_secrets_or_unexpected_fields_cannot_enter_worker(self):
        self.registry['token']='SYNTHETIC_SECRET_MUST_NOT_COPY';self.write()
        with self.assertRaises(Stop):build_private_release(self.file,self.root/'output')
        self.assertFalse((self.root/'output').exists())
    def test_registry_in_git_blocks(self):
        git=self.root/'repo';(git/'.git').mkdir(parents=True);(git/'.git/HEAD').write_text('ref: refs/heads/main')
        file=git/'registry.json';save_json(file,self.registry)
        with self.assertRaises(Stop):inspect_registry(file)
    def test_output_in_git_blocks(self):
        git=self.root/'repo';(git/'.git').mkdir(parents=True);(git/'.git/HEAD').write_text('ref: refs/heads/main')
        with self.assertRaises(Stop):build_private_release(self.file,git/'release')
    def test_no_node_does_not_copy_registry(self):
        with patch('release_build.node_path',side_effect=Stop('NO_NODE')):
            with self.assertRaises(Stop):build_private_release(self.file,self.root/'output')
        self.assertFalse((self.root/'output').exists())
    def test_dacl_error_stops_before_any_private_copy(self):
        for error in ('SeSecurityPrivilege unavailable','PRIVATE_ACL_TOO_BROAD','PRIVATE_DACL_WRITE_FAILED'):
            with self.subTest(error=error):
                with patch('release_build.protect_release_folder',side_effect=Stop(error)):
                    with self.assertRaises(Stop):build_private_release(self.file,self.root/'output')
                self.assertFalse(list((self.root/'output').rglob('telegram-registry.json')))
                self.assertFalse(list((self.root/'output').rglob('ASTRA_2_5_WORKER.js')))
                self.assertFalse(list((self.root/'output').rglob('safe-build-receipt.json')))
    def test_windows_helper_failure_is_not_ignored_or_retried(self):
        with patch('release_build.os') as platform, patch('release_build.subprocess.run') as run, patch('release_build.subprocess.CREATE_NO_WINDOW',0,create=True):
            platform.name='nt';platform.environ={}
            run.return_value.returncode=1
            run.return_value.stderr=b'SeSecurityPrivilege unavailable'
            with self.assertRaises(Stop):protect_release_folder(self.root)
            run.assert_called_once()
            command=run.call_args.args[0]
            self.assertEqual(command[0],'powershell.exe')
            self.assertNotIn('-Verb',command)
    def test_unsafe_symlink_rejected(self):
        alias=self.root/'alias.json';alias.symlink_to(self.file)
        with self.assertRaises(Stop):inspect_registry(alias)


if __name__=='__main__':unittest.main()
