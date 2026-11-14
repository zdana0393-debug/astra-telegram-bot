"""Synthetic offline security tests. Not a Windows/Cloudflare certification."""
import base64, hashlib, hmac, importlib.util, json, os, pathlib, subprocess, tempfile, unittest, sys
from unittest.mock import patch
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('private_tools',ROOT/'review/astra251/private_tools.py');tools=importlib.util.module_from_spec(spec);spec.loader.exec_module(tools)
class PrivateToolsTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='astra251-synthetic-',dir='/tmp');self.home=pathlib.Path(self.temp.name);self.home.chmod(0o700)
        self.receipt={'bot_id':901,'worker_sha256':'a'*64,'challenge_hash':'b'*64}
        self.key='SYNTHETIC_KEY_NOT_REAL_01234567890123456789'
        self.payload=['astra251-owner-v1',901,12,'SYNTHETIC_GENERATION','a'*64,tools.PARENT_SHA,'b'*64,100,10,1000]
    def tearDown(self):self.temp.cleanup()
    def proof(self,p=None,key=None):
        raw=json.dumps(p or self.payload,separators=(',',':')).encode();return base64.urlsafe_b64encode(raw).decode().rstrip('=')+'.'+hmac.new((key or self.key).encode(),raw,hashlib.sha256).hexdigest()
    def test_real_signed_payload_numeric_id_derived_from_bot_proof(self):self.assertEqual(tools.verify_proof(self.proof(),self.key,self.receipt)[2],12)
    def test_local_typed_id_is_not_a_proof(self):
        with self.assertRaisesRegex(RuntimeError,'FORMAT'):tools.verify_proof('12',self.key,self.receipt)
    def test_wrong_signature(self):
        with self.assertRaisesRegex(RuntimeError,'SIGNATURE'):tools.verify_proof(self.proof(key='ATTACKER'),self.key,self.receipt)
    def test_altered_owner(self):
        proof=self.proof();raw=base64.urlsafe_b64decode(proof.split('.')[0]+'==');raw=raw.replace(b',12,',b',13,');modified=base64.urlsafe_b64encode(raw).decode().rstrip('=')+'.'+proof.split('.')[1]
        with self.assertRaisesRegex(RuntimeError,'SIGNATURE'):tools.verify_proof(modified,self.key,self.receipt)
    def test_wrong_build_or_nonce_or_bot(self):
        for field,value in[(1,902),(4,'c'*64),(5,'d'*64),(6,'e'*64)]:
            p=self.payload.copy();p[field]=value
            with self.subTest(field=field),self.assertRaisesRegex(RuntimeError,'BUILD_SCOPE'):tools.verify_proof(self.proof(p),self.key,self.receipt)
    def test_boolean_or_out_of_range_owner(self):
        for owner in[True,0,-1,2**52,'12']:
            p=self.payload.copy();p[2]=owner
            with self.subTest(owner=owner),self.assertRaisesRegex(RuntimeError,'ACTOR'):tools.verify_proof(self.proof(p),self.key,self.receipt)
    def test_link_and_git_and_broad_modes_rejected(self):
        a=self.home/'a';a.write_text('SYNTHETIC');a.chmod(0o600);b=self.home/'b';b.symlink_to(a)
        with self.assertRaisesRegex(RuntimeError,'LINK'):tools.private_path(b)
        (self.home/'.git').mkdir();(self.home/'.git/HEAD').write_text('ref: refs/heads/SYNTHETIC')
        with self.assertRaisesRegex(RuntimeError,'GIT'):tools.private_path(a)
        (self.home/'.git/HEAD').unlink();(self.home/'.git').rmdir();a.chmod(0o644)
        with self.assertRaisesRegex(RuntimeError,'MODE'):tools.private_path(a)
    def test_new_outputs_never_overwrite(self):
        p=self.home/'x';tools.save(p,'FIRST')
        with self.assertRaisesRegex(RuntimeError,'OUTPUT_EXISTS'):tools.save(p,'SECOND')
        self.assertEqual(p.read_text(),'FIRST')
    def test_windows_acl_check_failure_prevents_private_input(self):
        p=self.home/'x';p.write_text('SYNTHETIC')
        with patch.object(tools.os,'name','nt'),patch.object(tools,'Path',pathlib.PosixPath),patch.object(tools.subprocess,'run',return_value=type('R',(),{'returncode':1})()):
            with self.assertRaisesRegex(RuntimeError,'DACL'):tools.private_path(p)
    def test_strict_known_parent_sha_and_receipt(self):
        d=json.loads((ROOT/'release/ASTRA_2_5_1_PATCH.json').read_text())
        with self.assertRaisesRegex(RuntimeError,'PARENT_SHA'):tools.patch(b'UNKNOWN_PRIVATE_INPUT',d)
    def test_public_delta_integrity_and_registry_byte_preservation(self):
        # Pure patch test uses generated fake media only, never owner's private JS.
        result=subprocess.run(['node','--input-type=module','-e',"import{publicParent251}from'./scripts/build-astra251.mjs';process.stdout.write(publicParent251())"],cwd=ROOT,capture_output=True,check=True)
        old=result.stdout;d=json.loads((ROOT/'release/ASTRA_2_5_1_PATCH.json').read_text());d['parent_sha256']=tools.sha(old);d.pop('package_sha256');d['package_sha256']=tools.sha(tools.canonical(d))
        new=tools.patch(old,d,expected_sha=tools.sha(old));self.assertEqual(tools.registry_literal(old.decode())[2],tools.registry_literal(new.decode())[2]);self.assertIn(b'ASTRA-2.5.1-stars-admin',new)
        d['replacements'][0]['after']='EVIL'
        with self.assertRaisesRegex(RuntimeError,'DELTA_DIGEST'):tools.patch(old,d,expected_sha=tools.sha(old))
    def snapshot(self):return{'active_version_id':'1292cc45-0f93-4074-8c41-bbcfc06ef625','captured_at':'2026-11-13T00:00:00Z','reviewed_complete_current_config':True,'configuration':{'name':'opel-astra-bot','compatibility_date':'2026-11-03','triggers':{'crons':['* 6-7 * * *']},'observability':{'enabled':True,'logs':{'enabled':True,'head_sampling_rate':0.5}},'vars':{'CHANNEL_USERNAME':'@SYNTHETIC','CUSTOM_UNCHANGED_FLAG':'keep',**{k:'false'for k in['STARS_SHOP_ENABLED','ASTRA_DAILY_DELIVERY_ENABLED','ASTRA_ECONOMY_V2_ENABLED','ASTRA_TAROT25_QUESTIONS_TEST_MODE','ASTRA_TELEGRAM_TEST_MODE']}},'d1_databases':[{'binding':'DB','database_name':'astra25-release','database_id':tools.DB_ID}]}}
    def stage(self,s,bootstrap=True):
        p=self.home/'snapshot.json';p.write_text(json.dumps(s));p.chmod(0o600)
        with patch.object(tools,'prepared',return_value=({**self.receipt,'parent_sha256':tools.PARENT_SHA},b'SYNTHETIC_WORKER')):return tools.stage_plan(self.home,p,bootstrap)
    def test_bootstrap_stage_preserves_current_config_off_gates_no_secret_upload(self):
        s=self.snapshot();original=json.loads(json.dumps(s));plan=self.stage(s)
        cfg=json.loads((self.home/'wrangler-astra251-bootstrap-private.json').read_text());self.assertEqual(cfg['observability'],original['configuration']['observability']);self.assertEqual(cfg['vars']['CHANNEL_USERNAME'],'@SYNTHETIC');self.assertEqual(cfg['vars']['CUSTOM_UNCHANGED_FLAG'],'keep');self.assertEqual(cfg['vars']['STARS_SHOP_ENABLED'],'false');self.assertNotIn('ASTRA_OWNER_TELEGRAM_ID',cfg['vars']);self.assertFalse(plan['traffic_changed']);self.assertNotIn('--secrets-file',plan['command']);self.assertNotIn('--strict',plan['command']);self.assertIn('upload',plan['command'])
    def test_bootstrap_then_confirmation_then_owner_plan_without_overwrite(self):
        tools.save_json(self.home/tools.RECEIPT,self.receipt)
        self.stage(self.snapshot())
        with patch.object(tools,'prepared',return_value=(self.receipt,b'SYNTHETIC_WORKER')),patch.object(tools,'secret',return_value=self.key):
            tools.confirm(self.home,self.proof())
            plan=self.stage(self.snapshot(),False)
        self.assertEqual(plan['mode'],'owner-attested-stars-off')
        self.assertTrue((self.home/'wrangler-astra251-bootstrap-private.json').exists())
        cfg=json.loads((self.home/'wrangler-astra251-owner-private.json').read_text());self.assertEqual(cfg['vars']['ASTRA_OWNER_TELEGRAM_ID'],'12')
    def test_typed_owner_in_bootstrap_cannot_stage(self):
        s=self.snapshot();s['configuration']['vars']['ASTRA_OWNER_TELEGRAM_ID']='12'
        with self.assertRaisesRegex(RuntimeError,'BOOTSTRAP_OWNER'):self.stage(s)
    def test_no_current_snapshot_no_plan(self):
        s=self.snapshot();s['reviewed_complete_current_config']=False
        with self.assertRaisesRegex(RuntimeError,'UNVERIFIED'):self.stage(s)
    def test_no_implicit_payment_approval(self):
        s=self.snapshot();s['configuration']['vars']['ASTRA_STARS_LIVE_APPROVED']='YES_I_AUTHORIZE_REAL_STARS'
        with self.assertRaisesRegex(RuntimeError,'COMMERCE_APPROVAL'):self.stage(s)
    def test_existing_admin_secret_can_never_become_plain_variable(self):
        s=self.snapshot();s['configuration']['vars']['ASTRA_ADMIN_KEY']='SYNTHETIC_NOT_REAL'
        with self.assertRaisesRegex(RuntimeError,'PLAIN_SECRET'):self.stage(s)
    def test_unsafe_config_does_not_upload_adjacent_private_files(self):
        s=self.snapshot();s['configuration']['assets']={'directory':'.'}
        with self.assertRaisesRegex(RuntimeError,'UNSUPPORTED_PLATFORM'):self.stage(s)
    def test_backup_gui_reports_safe_named_check_without_private_payload(self):
        module_spec=importlib.util.spec_from_file_location('backup_verify',ROOT/'review/astra251/ASTRA25_1_VERIFY_BACKUP.py');module=importlib.util.module_from_spec(module_spec)
        with patch.dict(sys.modules,{'private_tools':tools}):module_spec.loader.exec_module(module)
        source_folder=self.home/'source';source_folder.mkdir(mode=0o700);source=source_folder/'backup.sql';source.write_text('SYNTHETIC_LOCAL_ONLY');source.chmod(0o600)
        for check,suffix in [('tariff_data','_CHECK_TARIFF_DATA'),('schema31/12','_CHECK_SCHEMA31_12'),('SELECT private_value','')]:
            report={'status':'STOP','step':'RESTORE_INTEGRITY','code':'TAROT29_AUDIT_FAILED','check':check,'ignored_private_field':'DO_NOT_PRINT'}
            result=type('R',(),{'returncode':1,'stdout':json.dumps(report).encode()})()
            with self.subTest(check=check),patch.object(module.subprocess,'run',return_value=result),patch.object(module.shutil,'which',return_value='node'):
                with self.assertRaises(RuntimeError)as error:module.verify_file(source)
                self.assertEqual(str(error.exception),'LOCAL_RESTORE_INTEGRITY_TAROT29_AUDIT_FAILED'+suffix)
                self.assertNotIn('DO_NOT_PRINT',str(error.exception))
    def test_owner_mode_requires_signed_proof_not_private_numeric_file(self):
        with self.assertRaisesRegex(RuntimeError,'FILE_REQUIRED'):self.stage(self.snapshot(),False)
if __name__=='__main__':unittest.main()
