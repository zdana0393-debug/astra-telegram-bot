"""Actual offline Node assembly; only synthetic file IDs and temporary private files."""
import json
import hashlib
from pathlib import Path
import sys
import tempfile
import unittest
import subprocess
import sqlite3
import hmac
from types import SimpleNamespace
from unittest.mock import patch

ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'tools/tarot-bulk-loader'))
from release_build import inspect_registry,build_private_release,clean_env,protect_release_folder,safe_dacl_failure
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
    def test_final_release_profile_preserves_all_ids_and_requires_real_readiness(self):
        folder,receipt=build_private_release(self.file,self.root/'final',release=True)
        code=(folder/'ASTRA_2_5_WORKER.js').read_text()
        self.assertEqual(receipt['release_profile'],'clean-release')
        self.assertIn("readiness_scope='operational_checks_only'",code)
        self.assertIn('FINAL_SCHEMA_MISMATCH',code)
        for card in self.registry['cards']:
            for mode in ('upright','reversed'):self.assertIn(card[mode]['file_id'],code)
        self.assertFalse(receipt['deployed']);self.assertFalse(receipt['public_ready'])
        settings=(folder/'CLOUDFLARE_SETTINGS_PRIVATE.txt').read_text()
        key=settings.split('ASTRA_BONUS_FENCE_KEY = ')[1].splitlines()[0]
        check=hmac.new(key.encode(),b'astra:bonus-fence:v1:check:configuration',hashlib.sha256).hexdigest()
        self.assertNotIn(key,code);self.assertNotIn(key,json.dumps(receipt));self.assertNotIn(check,json.dumps(receipt))
        self.assertIn('ASTRA_TAROT_ART_ENABLED = true',settings)
        self.assertIn('STARS_SHOP_ENABLED = false',settings)
        sql=(folder/'SETUP_NEW_D1.sql').read_text();self.assertIn(check,sql)
        db=sqlite3.connect(':memory:')
        try:
            db.executescript((ROOT/'release/ASTRA_2_5_CLEAN_SCHEMA.sql').read_text())
            db.executescript(sql);db.executescript(sql)
            self.assertEqual(db.execute('SELECT check_hmac FROM astra_bonus_keys26').fetchone()[0],check)
            self.assertEqual(db.execute('SELECT notice_approved FROM astra_patch26').fetchone()[0],1)
            self.assertEqual(db.execute('SELECT count(*) FROM astra_users').fetchone()[0],0)
            self.assertEqual(db.execute('SELECT enabled FROM astra_tarot25_runtime29').fetchone()[0],0)
            with self.assertRaises(sqlite3.IntegrityError):db.executescript(sql.replace(check,'1'*64))
            self.assertEqual(db.execute('SELECT check_hmac FROM astra_bonus_keys26').fetchone()[0],check)
        finally:db.close()
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
            self.assertIn('-NewEmptyBuild',command)
            self.assertIn('-ExpectedParent',command)
    def test_safe_dacl_diagnostics_only_include_codes_and_aggregate_counts(self):
        raw=SimpleNamespace(stdout=b'ASTRA_DACL_DIAG explicit_allow=2 explicit_deny=0 inherited_extra=1 everyone=1 authenticated_users=1 users=1 other=0\r\n',
                            stderr=b'ASTRA_DACL_ERROR:PRIVATE_ACL_TOO_BROAD\r\nSYNTHETIC_SECRET FILE_ID_SENSITIVE C:/Private/Name S-1-5-21-12345\r\n')
        message=safe_dacl_failure(raw)
        self.assertIn('PRIVATE_ACL_TOO_BROAD',message)
        self.assertIn('Allow=2',message)
        self.assertIn('Everyone=1',message)
        for private in ('SYNTHETIC_SECRET','FILE_ID_SENSITIVE','C:/Private','S-1-5-21'):
            self.assertNotIn(private,message)
    def test_unknown_dacl_error_does_not_leak_arbitrary_text(self):
        message=safe_dacl_failure(SimpleNamespace(stdout=b'',stderr=b'ASTRA_DACL_ERROR:SYNTHETIC_SECRET'))
        self.assertIn('PRIVATE_DACL_UNEXPECTED',message)
        self.assertNotIn('SYNTHETIC_SECRET',message)
    def test_windows_helper_exit_zero_without_success_ack_is_refused(self):
        with patch('release_build.os') as platform, patch('release_build.subprocess.run') as run, patch('release_build.subprocess.CREATE_NO_WINDOW',0,create=True):
            platform.name='nt';platform.environ={}
            run.return_value=SimpleNamespace(returncode=0,stdout=b'',stderr=b'')
            with self.assertRaises(Stop):protect_release_folder(self.root)
    def test_safe_reason_reaches_windows_build_error(self):
        with patch('release_build.os') as platform, patch('release_build.subprocess.run') as run, patch('release_build.subprocess.CREATE_NO_WINDOW',0,create=True):
            platform.name='nt';platform.environ={}
            run.return_value=SimpleNamespace(returncode=1,stdout=b'',stderr=b'ASTRA_DACL_ERROR:PRIVATE_BUILD_NOT_EMPTY\nSYNTHETIC_SECRET')
            with self.assertRaises(Stop) as error:protect_release_folder(self.root)
            self.assertIn('PRIVATE_BUILD_NOT_EMPTY',str(error.exception))
            self.assertNotIn('SYNTHETIC_SECRET',str(error.exception))
    def test_windows_launch_errors_have_safe_specific_reasons(self):
        for failure,code in ((OSError('SYNTHETIC_SECRET'),'PRIVATE_DACL_LAUNCH_FAILED'),(subprocess.TimeoutExpired('SYNTHETIC_SECRET',60),'PRIVATE_DACL_TIMEOUT')):
            with self.subTest(code=code):
                with patch('release_build.os') as platform, patch('release_build.subprocess.run',side_effect=failure), patch('release_build.subprocess.CREATE_NO_WINDOW',0,create=True):
                    platform.name='nt';platform.environ={}
                    with self.assertRaises(Stop) as error:protect_release_folder(self.root)
                    self.assertIn(code,str(error.exception))
                    self.assertNotIn('SYNTHETIC_SECRET',str(error.exception))
    def test_unsafe_symlink_rejected(self):
        alias=self.root/'alias.json';alias.symlink_to(self.file)
        with self.assertRaises(Stop):inspect_registry(alias)


if __name__=='__main__':unittest.main()
