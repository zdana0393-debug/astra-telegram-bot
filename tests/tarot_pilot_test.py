"""Every API call is an injected fake. Never contacts Telegram."""
import contextlib
import hashlib
import importlib.machinery
import importlib.util
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
import urllib.error
import zipfile
from unittest.mock import patch

TOOLS = Path(__file__).resolve().parent.parent / 'tools/tarot-pilot'
sys.path.insert(0, str(TOOLS))
from pilot_core import BOT, Telegram, Journal, Stop, owner_id, run_two, load_card, load_owner_archive, NoRedirect

TOKEN = str(123456789) + ':' + 'OFFLINE_SYNTHETIC_TOKEN_NEVER_REAL_123'
IMAGE = b'\xff\xd8\xffONLY_SYNTHETIC_TEST_BYTES'
META = {'card_id':'major-00','orientation':'upright','deck_version':'rws78-v1',
        'art_version':'SYNTHETIC','sha256':hashlib.sha256(IMAGE).hexdigest()}


class Fake:
    def __init__(self): self.calls=[]; self.fault=None; self.on_second=None
    def __call__(self, method, data, content_type):
        self.calls.append((method, data, content_type))
        if method == 'getMe': result={'id':123456789,'username':BOT,'is_bot':True}
        elif method == 'getChat': result={'id':12345,'type':'private','first_name':'SYNTHETIC OWNER'}
        else:
            send_number=sum(c[0]=='sendPhoto' for c in self.calls)
            if send_number==2 and self.on_second: self.on_second()
            if self.fault=='network': raise OSError(TOKEN)
            if self.fault in [400,403,429,500]: raise Stop('FAKE',self.fault)
            result={'message_id':100+send_number,'chat':{'id':12345,'type':'private'},
                    'from':{'id':123456789,'is_bot':True},
                    'photo':[{'file_id':'SYNTHETIC_REAL_STYLE_FILE_ID','file_unique_id':'SYNTHETIC_UNIQUE','width':960,'height':1357}]}
            if self.fault=='unknown_ack':result=True
            if self.fault=='wrong_chat':result['chat']['id']=54321
            if self.fault=='wrong_sender':result['from']['id']=777777
            if self.fault=='no_photo':result['photo']=[]
            if send_number==2 and self.fault=='duplicate_message':result['message_id']=101
            if send_number==2 and self.fault=='different_photo':result['photo'][0]['file_unique_id']='DIFFERENT'
        return {'ok':True,'result':result}


class Pilot(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='astra-pilot-test-');self.root=Path(self.temp.name)
        self.fake=Fake();self.client=Telegram(TOKEN,12345,exchange=self.fake);self.client.verify()
        self.journal=Journal(self.root/'private')
    def tearDown(self):self.temp.cleanup()
    def run_pilot(self,approved=True):return run_two(self.client,META,IMAGE,self.journal,approved=approved,pause=lambda n:self.assertEqual(n,2))
    def sends(self):return [c for c in self.fake.calls if c[0]=='sendPhoto']

    def test_exactly_two_sends_upload_then_id_and_private_checkpoint(self):
        def checkpoint():
            saved=json.loads(self.journal.file.read_text());self.assertEqual(saved['phase'],'reuse_sending')
            self.assertEqual(saved['acks'][0]['file_id'],'SYNTHETIC_REAL_STYLE_FILE_ID')
        self.fake.on_second=checkpoint
        result=self.run_pilot();self.assertEqual(result['phase'],'completed')
        self.assertEqual([c[0] for c in self.fake.calls],['getMe','getChat','sendPhoto','sendPhoto'])
        sends=self.sends();self.assertIn(IMAGE,sends[0][1]);self.assertNotIn(IMAGE,sends[1][1])
        self.assertTrue(sends[0][2].startswith('multipart/form-data'))
        second=json.loads(sends[1][1]);self.assertEqual(second['photo'],'SYNTHETIC_REAL_STYLE_FILE_ID');self.assertEqual(second['chat_id'],12345)
        saved=self.journal.file.read_text();self.assertNotIn(TOKEN,saved);self.assertNotIn('token',saved.lower())

    def test_no_consent_no_sends_or_journal(self):
        with self.assertRaises(Stop):self.run_pilot(False)
        self.assertEqual(len(self.sends()),0);self.assertFalse(self.journal.file.exists())
    def test_no_verification(self):
        self.client.verified=None
        with self.assertRaises(Stop):self.run_pilot()
        self.assertFalse(self.sends())
    def test_changed_target_after_verification(self):
        self.client.target=54321
        with self.assertRaises(Stop):self.run_pilot()
        self.assertFalse(self.sends())
    def test_wrong_request_target_blocked_before_transport(self):
        n=len(self.fake.calls)
        with self.assertRaises(Stop):self.client.call('sendPhoto',{'chat_id':54321,'photo':'x'})
        self.assertEqual(len(self.fake.calls),n)
    def test_direct_photo_without_confirmation_is_blocked(self):
        with self.assertRaises(Stop):self.client.call('sendPhoto',{'chat_id':12345,'photo':'test'})
        self.assertFalse(self.sends())
    def test_third_message_is_blocked(self):
        self.run_pilot()
        with self.assertRaises(Stop):self.client.call('sendPhoto',{'chat_id':12345,'photo':'SYNTHETIC_REAL_STYLE_FILE_ID'})
        self.assertEqual(len(self.sends()),2)
    def test_target_change_during_pause_blocks_second_send(self):
        def pause(n):self.client.target=54321
        with self.assertRaises(Stop):run_two(self.client,META,IMAGE,self.journal,approved=True,pause=pause)
        self.assertEqual(len(self.sends()),1)
    def test_forbidden_methods(self):
        for method in ['getUpdates','setWebhook','deleteWebhook','sendInvoice','refundStarPayment']:
            with self.assertRaises(Stop):self.client.call(method,{})
    def test_file_change_blocks_sending(self):
        with self.assertRaises(Stop):run_two(self.client,META,b'bad',self.journal,approved=True)
        self.assertFalse(self.sends())
    def test_rerun_or_parallel_process_blocks_before_message(self):
        self.run_pilot();n=len(self.sends())
        with self.assertRaises(Exception):self.run_pilot()
        with self.assertRaises(Stop):Journal(self.journal.folder)
        self.assertEqual(len(self.sends()),n)
    def test_initial_disk_failure_blocks_http(self):
        with patch.object(self.journal,'begin',side_effect=OSError('disk')):
            with self.assertRaises(Exception):self.run_pilot()
        self.assertFalse(self.sends())
    def test_ack_disk_failure_blocks_second_send(self):
        with patch.object(self.journal,'save',side_effect=OSError('disk')):
            with self.assertRaises(Stop):self.run_pilot()
        self.assertEqual(len(self.sends()),1)
    def test_journal_cannot_live_in_git(self):
        git=self.root/'repo';(git/'.git').mkdir(parents=True);(git/'.git/HEAD').write_text('ref: refs/heads/main')
        with self.assertRaises(Stop):Journal(git/'private')
    def test_card_package_integrity(self):
        (self.root/'pilot-card.json').write_text(json.dumps(META));(self.root/'major-00-upright.jpg').write_bytes(IMAGE)
        self.assertEqual(load_card(self.root)[1],IMAGE)
        (self.root/'major-00-upright.jpg').write_bytes(b'bad')
        with self.assertRaises(Stop):load_card(self.root)
    def test_owner_input_rejects_channel_and_username(self):
        for value in ['-1001234','@owner','0','1.0','True','+12345','9007199254740992']:
            with self.assertRaises(Stop):owner_id(value)
        self.assertEqual(owner_id('12345'),12345)
    def test_redirects_disabled(self):self.assertIsNone(NoRedirect().redirect_request(None,None,None,None,None,None))


def fault_test(fault):
    def body(self):
        self.fake.fault=fault
        with self.assertRaises(Stop) as caught:self.run_pilot()
        self.assertNotIn(TOKEN,str(caught.exception))
        self.assertEqual(len(self.sends()),2 if fault in ['different_photo','duplicate_message'] else 1)
        self.assertEqual(json.loads(self.journal.file.read_text())['phase'],'stopped_unknown')
    return body
for fault in [400,403,429,500,'network','unknown_ack','wrong_chat','wrong_sender','no_photo','duplicate_message','different_photo']:
    setattr(Pilot,'test_no_automatic_retry_'+str(fault),fault_test(fault))


class Identity(unittest.TestCase):
    def test_read_owner_zip_without_private_files_in_program_folder(self):
        with tempfile.TemporaryDirectory(prefix='astra-owner-zip-') as folder:
            root=Path(folder)
            manifest={'manifest_version':'astra-author-art-assets-v1','deck_version':'rws78-v1','card_count':78,'art_version':'SYNTHETIC',
                      'cards':[{'card_id':'major-00','asset_id':'rws78-v1/major-00','upright_rotation':0,'telegram_image':'cards/major-00.jpg',
                                'telegram_image_sha256':META['sha256'],'source_name':'NOT_PRESENT.png','source_sha256':'f'*64}]
                              +[{'card_id':'synthetic-'+str(i)} for i in range(77)]}
            p=root/'manifest.json';p.write_text(json.dumps(manifest));z=root/'part01.zip'
            with zipfile.ZipFile(z,'w') as archive:archive.writestr('cards/major-00.jpg',IMAGE)
            before={file.name:file.read_bytes() for file in root.iterdir()}
            meta,data=load_owner_archive(p,z);self.assertEqual(data,IMAGE);self.assertEqual(meta['sha256'],META['sha256'])
            self.assertEqual({file.name:file.read_bytes() for file in root.iterdir()},before)
            manifest['cards'][0]['telegram_image_sha256']='0'*64;p.write_text(json.dumps(manifest))
            with self.assertRaises(Stop):load_owner_archive(p,z)
    def test_default_https_errors_do_not_leak_url_token_or_retry(self):
        for error in [urllib.error.URLError(TOKEN),urllib.error.HTTPError('https://invalid/'+TOKEN,429,TOKEN,None,None)]:
            with patch('urllib.request.build_opener') as build:
                build.return_value.open.side_effect=error
                with self.assertRaises(Stop) as caught:Telegram(TOKEN,12345).verify()
                self.assertNotIn(TOKEN,str(caught.exception));self.assertEqual(build.return_value.open.call_count,1)
    def test_default_https_is_fixed_post_and_metadata_only(self):
        responses=[{'ok':True,'result':{'id':123456789,'username':BOT,'is_bot':True}},
                   {'ok':True,'result':{'id':12345,'type':'private'}}]
        requests=[]
        class Response:
            status=200
            def __init__(self,value):self.value=value
            def __enter__(self):return self
            def __exit__(self,*args):pass
            def read(self,limit):return json.dumps(self.value).encode()
        def open_(request,timeout):
            requests.append(request);return Response(responses.pop(0))
        with patch('urllib.request.build_opener') as build:
            build.return_value.open.side_effect=open_
            Telegram(TOKEN,12345).verify()
        self.assertEqual([r.full_url.rsplit('/',1)[1] for r in requests],['getMe','getChat'])
        for r in requests:
            self.assertTrue(r.full_url.startswith('https://api.telegram.org/bot'+TOKEN+'/'))
            self.assertEqual(r.get_method(),'POST');self.assertNotIn(TOKEN.encode(),r.data)
    def test_identity_mismatches_never_send(self):
        for mutation in ['username','bot_id','group','chat_id']:
            fake=Fake()
            def exchange(method,data,kind):
                r=fake(method,data,kind)
                if mutation=='username' and method=='getMe':r['result']['username']='OtherBot'
                if mutation=='bot_id' and method=='getMe':r['result']['id']=777777
                if mutation=='group' and method=='getChat':r['result']['type']='channel'
                if mutation=='chat_id' and method=='getChat':r['result']['id']=54321
                return r
            client=Telegram(TOKEN,12345,exchange=exchange)
            with self.assertRaises(Stop):client.verify()
            self.assertFalse([c for c in fake.calls if c[0]=='sendPhoto'])
    def test_gui_module_import_never_connects(self):
        loader=importlib.machinery.SourceFileLoader('astra_pilot_gui',str(TOOLS/'astra_pilot.pyw'))
        module=importlib.util.module_from_spec(importlib.util.spec_from_loader(loader.name,loader))
        with patch('urllib.request.OpenerDirector.open',side_effect=AssertionError('NETWORK FORBIDDEN')):loader.exec_module(module)
        self.assertTrue(callable(module.App));self.assertEqual(module.label('Owner\u202e\n'),'Owner')


if __name__=='__main__':unittest.main()
