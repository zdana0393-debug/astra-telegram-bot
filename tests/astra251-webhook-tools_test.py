import hashlib,importlib.util,json,pathlib,subprocess,tempfile,unittest
from unittest.mock import patch
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('webhook_tool',ROOT/'review/astra251/ASTRA25_1_FIX_STARS_WEBHOOK.py');tool=importlib.util.module_from_spec(spec);spec.loader.exec_module(tool)
class WebhookTools(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.parent=subprocess.run(['node','--input-type=module','-e',"import{build251,apply251,publicParent251}from'./scripts/build-astra251.mjs';process.stdout.write(apply251(publicParent251(),await build251()));"],cwd=ROOT,capture_output=True,check=True).stdout
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(prefix='astra251-private-webhook-',dir='/tmp');self.home=pathlib.Path(self.tmp.name);self.home.chmod(0o700)
        text=self.parent.decode();reg=tool.literal(text)[2]
        self.receipt={'version':'astra251-private-prepared-v2','worker_sha256':tool.sha(self.parent),'worker_bytes':len(self.parent),'package_sha256':tool.PATCH['base_package_sha256'],'registry_literal_sha256':tool.sha(reg.encode())}
        for name,data in[(tool.WORKER,self.parent),('ASTRA25_1_SAFE_RECEIPT.json',json.dumps(self.receipt).encode()),('telegram-registry.json',reg.encode())]:
            p=self.home/name;p.write_bytes(data);p.chmod(0o600)
    def tearDown(self):self.tmp.cleanup()
    def test_patch_preserves_original_registry_authority_and_no_network(self):
        old={p.name:p.read_bytes()for p in self.home.iterdir()};out,r=tool.prepare(self.home,clipboard=False)
        self.assertIn(b'ASTRA-2.5.1-stars-admin-webhook',out.read_bytes());self.assertEqual(tool.literal(out.read_text())[2],tool.literal(self.parent.decode())[2]);self.assertEqual(r['owner_authority_sha256'],self.receipt['worker_sha256']);self.assertFalse(r['network_used']);self.assertFalse(r['sql_executed'])
        for name,b in old.items():self.assertEqual((self.home/name).read_bytes(),b)
        self.assertEqual(tool.prepare(self.home,clipboard=False)[1],r)
    def test_wrong_parent_stops_before_output(self):
        p=self.home/tool.WORKER;p.write_bytes(self.parent+b' ')
        with self.assertRaisesRegex(RuntimeError,'RECEIPT'):tool.prepare(self.home,False)
        self.assertFalse((self.home/tool.OUTPUT).exists())
    def test_corrupt_public_patch_stops(self):
        with patch.dict(tool.PATCH,package_sha256='0'*64),self.assertRaisesRegex(RuntimeError,'DIGEST'):tool.prepare(self.home,False)
    def test_corrupt_private_registry_stops(self):
        (self.home/'telegram-registry.json').write_text('{}')
        with self.assertRaisesRegex(RuntimeError,'REGISTRY'):tool.prepare(self.home,False)
    def test_existing_different_output_not_overwritten(self):
        p=self.home/tool.OUTPUT;p.write_bytes(b'KEEP');p.chmod(0o600)
        with self.assertRaisesRegex(RuntimeError,'OUTPUT_EXISTS'):tool.prepare(self.home,False)
        self.assertEqual(p.read_bytes(),b'KEEP')
    def test_links_hardlinks_and_public_git_stopped(self):
        p=self.home/'link';p.symlink_to(self.home/tool.WORKER)
        with self.assertRaisesRegex(RuntimeError,'LINK'):tool.private(p)
        p.unlink();tool.os.link(self.home/tool.WORKER,p)
        with self.assertRaisesRegex(RuntimeError,'HARDLINK'):tool.private(p)
        p.unlink();(self.home/'.git').write_text('gitdir: elsewhere')
        with self.assertRaisesRegex(RuntimeError,'GIT'):tool.prepare(self.home,False)
    def test_broad_folder_stops_before_reading_private_data(self):
        self.home.chmod(0o755)
        with self.assertRaisesRegex(RuntimeError,'MODE'):tool.prepare(self.home,False)
        self.home.chmod(0o700)
    def test_node_failure_never_saves_or_copies_output(self):
        with patch.object(tool.subprocess,'run',return_value=type('R',(),{'returncode':1})()),patch.object(tool,'copy_worker')as copy,self.assertRaisesRegex(RuntimeError,'SYNTAX'):tool.prepare(self.home)
        copy.assert_not_called();self.assertFalse((self.home/tool.OUTPUT).exists())
    def test_dacl_failure_stops_before_private_copy(self):
        with patch.object(tool,'windows_acl',side_effect=RuntimeError('PRIVATE_DACL_CHECK_FAILED')),patch.object(tool,'copy_worker')as copy,self.assertRaisesRegex(RuntimeError,'DACL'):tool.prepare(self.home)
        copy.assert_not_called()
    def test_acl_script_does_not_write_acl_owner_or_sacl(self):
        for forbidden in ['Set-Acl','SetOwner','/setowner','-Audit','SeSecurityPrivilege']:self.assertNotIn(forbidden,tool.DACL_CHECK)
        for required in ['Get-Acl','AreAccessRulesProtected','S-1-5-18','S-1-5-32-544','GetAccessRules']:self.assertIn(required,tool.DACL_CHECK)
if __name__=='__main__':unittest.main()
