"""DACL regression guards + real tests on an ordinary Windows token, no live data/API.
Run: python -m unittest discover -s tests -p tarot_windows_dacl_test.py -v
Native cases skip explicitly outside Windows or with a privileged token.
"""
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT=Path(__file__).resolve().parent.parent
HELPER=ROOT/'tools/tarot-bulk-loader/protect_private_folder.ps1'
sys.path.insert(0,str(ROOT/'tools/tarot-bulk-loader'))
from release_build import clean_env, node_path
from bulk_core import Stop


class DaclSourceRegression(unittest.TestCase):
    def setUp(self):
        self.code='\n'.join(line.split('#',1)[0] for line in HELPER.read_text().splitlines())
    def test_no_owner_sacl_or_elevation_operations(self):
        self.assertNotRegex(self.code.lower(),r'set-acl|setowner|setsecuritydescriptor|/setowner|/setaudit|/restore|/reset|runas|adjusttokenprivileges')
        self.assertIn("'System32\\icacls.exe'",self.code)
        self.assertIn("'/inheritance:r', '/grant:r'",self.code)
        self.assertNotIn('/T',self.code)
    def test_numeric_principals_and_actual_acl_validation_are_mandatory(self):
        for guard in ('S-1-5-18','S-1-5-32-544','PRIVATE_OWNER_MISMATCH',
                      'PRIVATE_ACL_TOO_BROAD','PRIVATE_ACL_PRINCIPAL_MISSING',
                      'PRIVATE_DACL_WRITE_FAILED','PRIVATE_DACL_INHERITANCE',
                      'PRIVATE_ACL_CHILDREN','PRIVATE_ACL_PROPAGATION','PRIVATE_ACL_DENY'):
            self.assertIn(guard,self.code)
        self.assertIn('GetAccessRules($true, $true',self.code)
        self.assertIn('if (-not $CheckOnly)',self.code)


@unittest.skipUnless(os.name=='nt','NOT_TESTED: real Windows DACL required')
class OrdinaryWindowsDacl(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import ctypes
        if ctypes.windll.shell32.IsUserAnAdmin():
            raise unittest.SkipTest('Requires ordinary non-elevated Windows user')
        # Require the privilege to be absent, not merely present but disabled.
        whoami=Path(os.environ['SystemRoot'])/'System32/whoami.exe'
        token=subprocess.run([str(whoami),'/priv','/fo','csv','/nh'],capture_output=True,timeout=15)
        if token.returncode!=0:raise unittest.SkipTest('Cannot verify token privileges')
        if b'SeSecurityPrivilege' in token.stdout:
            raise unittest.SkipTest('Requires token without SeSecurityPrivilege')
        cls.icacls=str(Path(os.environ['SystemRoot'])/'System32/icacls.exe')
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='astra-dacl-')
        self.folder=Path(self.temp.name)/'private';self.folder.mkdir()
    def tearDown(self):self.temp.cleanup()
    def helper(self,path=None,check=False):
        args=['powershell.exe','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass',
              '-File',str(HELPER),'-Path',str(path or self.folder)]
        if check:args+=['-CheckOnly']
        return subprocess.run(args,capture_output=True,env=clean_env(),timeout=30)
    def rights(self,*args):
        result=subprocess.run([self.icacls,*map(str,args)],capture_output=True,timeout=15)
        self.assertEqual(result.returncode,0,'Synthetic fixture DACL setup failed')
    def test_without_security_privilege_folder_and_child_file_are_private(self):
        self.assertEqual(self.helper().returncode,0)
        self.assertEqual(self.helper(check=True).returncode,0)
        child=self.folder/'synthetic.json';child.write_text('{}')
        self.assertEqual(self.helper(child,check=True).returncode,0)
    def test_broad_explicit_grant_refused_in_check_and_configure_modes(self):
        self.assertEqual(self.helper().returncode,0)
        self.rights(self.folder,'/grant','*S-1-1-0:(OI)(CI)R','/Q')
        self.assertNotEqual(self.helper(check=True).returncode,0)
        self.assertNotEqual(self.helper().returncode,0)
    def test_missing_system_principal_refused(self):
        self.assertEqual(self.helper().returncode,0)
        self.rights(self.folder,'/remove:g','*S-1-5-18','/Q')
        self.assertNotEqual(self.helper(check=True).returncode,0)
    def test_broad_child_file_is_refused(self):
        self.assertEqual(self.helper().returncode,0)
        child=self.folder/'synthetic.json';child.write_text('{}')
        self.rights(child,'/grant','*S-1-1-0:R','/Q')
        self.assertNotEqual(self.helper(child,check=True).returncode,0)
    def test_actual_worker_build_on_ordinary_windows(self):
        try:node_path()
        except Stop:raise unittest.SkipTest('Node.js22+ required for actual Worker build')
        # The existing offline integration test uses all156 SYNTHETIC IDs only.
        from tarot_release_build_test import ReleaseBuild
        case=ReleaseBuild('test_actual_worker_is_private_no_api_and_receipt_has_no_ids')
        case.setUp()
        try:case.test_actual_worker_is_private_no_api_and_receipt_has_no_ids()
        finally:case.tearDown()


if __name__=='__main__':unittest.main()
