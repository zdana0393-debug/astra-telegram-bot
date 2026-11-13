"""No real Telegram. Tests real durable state, timing, image routing and recovery."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import threading
import unittest

ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'tools/tarot-bulk-loader'))
from bulk_core import Batch,Telegram,Stop,exclusive,save_json,items_from_manifest

TOKEN=str(123456789)+':'+'OFFLINE_SYNTHETIC_TOKEN_NEVER_REAL_123'


class Clock:
    def __init__(self):self.value=1000
    def now(self):return self.value
    def wait(self,seconds):self.value+=seconds;return False


class Fake:
    def __init__(self,clock):self.calls=[];self.clock=clock;self.fault=None;self.count=0;self.rate_once=False;self.root=None
    def __call__(self,method,data,kind):
        self.calls.append((method,data,kind,self.clock.now()))
        if method=='getMe':result={'id':123456789,'username':'LaDa_Iskra_Opel_Astrabot','is_bot':True}
        elif method=='getChat':result={'id':12345,'type':'private'}
        else:
            state=json.loads((self.root/'bulk-state.json').read_text())
            key=next(e['key'] for e in state['entries'] if e['status']=='uploading')
            if self.fault=='429' and not self.rate_once:
                self.rate_once=True;e=Stop('FAKE',429);e.retry_after=7;raise e
            if self.fault in ('network','500','403','bad_ack'):
                if self.fault=='bad_ack':return {'ok':True,'result':True}
                if self.fault=='network':raise OSError(TOKEN)
                raise Stop('FAKE',int(self.fault))
            self.count+=1;tag=key.replace('/','_')
            result={'message_id':1000+self.count,'chat':{'id':12345,'type':'private'},'from':{'id':123456789,'is_bot':True},
                    'photo':[{'file_id':'SYNTHETIC_'+tag,'file_unique_id':'UNIQUE_'+tag,'width':960,'height':1357}]}
            if self.fault=='wrong_chat':result['chat']['id']=54321
            if self.fault=='duplicate':result['photo'][0]['file_id']='SYNTHETIC_major-00_upright';result['photo'][0]['file_unique_id']='UNIQUE_major-00_upright'
        return {'ok':True,'result':result}


class Bulk(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='astra-bulk-test-');self.root=Path(self.temp.name)
        self.clock=Clock();self.fake=Fake(self.clock);self.client=Telegram(TOKEN,12345,exchange=self.fake);self.client.verify()
        self.folder=self.root/'private';self.fake.root=self.folder;self.rows=[]
        cards=json.loads((ROOT/'data/tarot25-art-contract07.json').read_text())
        for c in cards:
            for mode in ('upright','reversed'):
                data=(c['card_id']+'/'+mode).encode();p=self.root/(c['card_id']+'-'+mode+'.jpg');p.write_bytes(data)
                self.rows.append({'key':c['card_id']+'/'+mode,'card_id':c['card_id'],'orientation':mode,'path':str(p),'sha256':hashlib.sha256(data).hexdigest()})
        self.manifest={'art_version':'SYNTHETIC','source_manifest_sha256':'0'*64}
        self.stop=threading.Event()
    def tearDown(self):self.temp.cleanup()
    def batch(self,pilot=None):return Batch(self.folder,self.manifest,self.rows,self.client,pilot)
    def run_batch(self,b,progress=lambda *a:None):return b.run(True,self.stop,progress,now=self.clock.now,wait=self.clock.wait)
    def sends(self):return [c for c in self.fake.calls if c[0]=='sendPhoto']
    def ack(self,row,message=10):
        tag=row['key'].replace('/','_');return {'message_id':message,'file_id':'SYNTHETIC_'+tag,'file_unique_id':'UNIQUE_'+tag,'width':960,'height':1357}
    def pilot(self):
        row=self.rows[0]
        p={'version':'astra-tarot-pilot-v1','phase':'completed','bot_id':123456789,'chat_id':12345,'card_id':'major-00','orientation':'upright','art_version':'SYNTHETIC','sha256':row['sha256'],'acks':[self.ack(row,10),self.ack(row,11)]}
        path=self.root/'pilot.json';path.write_text(json.dumps(p));return path

    def test_full156_unique_registry_timing_and_private_data(self):
        b=self.batch();self.assertEqual(self.run_batch(b),'completed')
        self.assertEqual(len(self.sends()),156)
        times=[c[3] for c in self.sends()];self.assertTrue(all(y-x>=2 for x,y in zip(times,times[1:])))
        registry=json.loads((self.folder/'telegram-registry.json').read_text());self.assertEqual(len(registry['cards']),78)
        self.assertEqual(len({c[m]['file_id'] for c in registry['cards'] for m in ('upright','reversed')}),156)
        code="import fs from 'node:fs';import {validateTelegramArt} from './src/tarot25/art-delivery.mjs';import {writePrivateArtCandidate} from './scripts/build-tarot-art-private.mjs';const [r,o]=process.argv.slice(1);validateTelegramArt(JSON.parse(fs.readFileSync(r,'utf8')));writePrivateArtCandidate(r,o);"
        candidate=self.root/'candidate.mjs'
        process=subprocess.run(['node','--input-type=module','-e',code,str(self.folder/'telegram-registry.json'),str(candidate)],cwd=ROOT,capture_output=True)
        self.assertEqual(process.returncode,0,process.stderr.decode())
        self.assertEqual(subprocess.run(['node','--check',str(candidate)],capture_output=True).returncode,0)
        self.assertNotIn(TOKEN,(self.folder/'bulk-state.json').read_text())
        n=len(self.sends());self.assertEqual(self.run_batch(self.batch()),'completed');self.assertEqual(len(self.sends()),n)
    def test_successful_pilot_saves_one_upload(self):
        b=self.batch(self.pilot());self.assertEqual(b.counts()['done'],1)
        self.run_batch(b);self.assertEqual(len(self.sends()),155)
        self.assertNotIn(b'name="photo"; filename="major-00-upright.jpg"',self.sends()[0][1])  # first upload is reversed
        self.assertEqual(b.state['entries'][0]['source'],'successful_pilot')
    def test_import_pilot_after_preview_cancel_also_skips_fool(self):
        self.batch();b=self.batch(self.pilot());self.assertEqual(b.counts()['done'],1)
    def test_pause_resume_does_not_upload_confirmed_again(self):
        b=self.batch()
        def progress(state,count,key):
            if count['done']==3:self.stop.set()
        self.assertEqual(self.run_batch(b,progress),'paused');self.assertEqual(len(self.sends()),3)
        self.stop.clear();self.assertEqual(self.run_batch(self.batch()),'completed');self.assertEqual(len(self.sends()),156)
    def test429_honors_retry_after_and_does_not_duplicate_ack(self):
        self.fake.fault='429';b=self.batch();self.run_batch(b)
        self.assertEqual(len(self.sends()),157);self.assertGreaterEqual(self.sends()[1][3]-self.sends()[0][3],8)
        self.assertEqual(b.counts()['done'],156)
    def test_interruption_uploading_becomes_unknown_without_send(self):
        b=self.batch();b.state['entries'][0]['status']='uploading';b.save()
        b=self.batch();self.assertEqual(b.state['entries'][0]['status'],'unknown')
        with self.assertRaises(Stop):self.run_batch(b)
        self.assertEqual(len(self.sends()),0)
    def test_unknown_requires_explicit_owner_resolution(self):
        b=self.batch();b.state['entries'][0]['status']='unknown';b.save()
        with self.assertRaises(Stop):b.authorize_retry(self.rows[0]['key'])
        b.authorize_retry(self.rows[0]['key'],True);self.run_batch(b)
        self.assertEqual(len(self.sends()),156);self.assertEqual(len(b.state['entries'][0]['resolutions']),1)
    def test_changed_owner_or_bot_cannot_reuse_state(self):
        self.batch();self.client.target=54321;self.client.verified=(self.client.bot_id,54321)
        with self.assertRaises(Stop):self.batch()
    def test_tampered_card_stops_before_http(self):
        b=self.batch();Path(self.rows[0]['path']).write_bytes(b'CHANGED')
        with self.assertRaises(Stop):self.run_batch(b)
        self.assertEqual(len(self.sends()),0)
    def test_disk_failure_before_request_sends_nothing(self):
        b=self.batch()
        from unittest.mock import patch
        with patch.object(b,'save',side_effect=OSError('disk')):
            with self.assertRaises(OSError):self.run_batch(b)
        self.assertEqual(len(self.sends()),0)
    def test_registry_not_exported_while_incomplete(self):
        with self.assertRaises(Stop):self.batch().registry()
        self.assertFalse((self.folder/'telegram-registry.json').exists())
    def test_bad_pilot_fails_before_upload(self):
        path=self.pilot();p=json.loads(path.read_text());p['chat_id']=54321;path.write_text(json.dumps(p))
        with self.assertRaises(Stop):self.batch(path)
        self.assertEqual(len(self.sends()),0)
    def test_lock_prevents_parallel_process_and_releases(self):
        with exclusive(self.folder):
            with self.assertRaises(Stop):
                with exclusive(self.folder):pass
        with exclusive(self.folder):pass
    def test_killed_process_releases_os_lock_without_deleting_state(self):
        import time
        flag=self.root/'ready'
        code="import sys,time;from pathlib import Path;sys.path.insert(0,sys.argv[1]);from bulk_core import exclusive\nwith exclusive(sys.argv[2]):\n Path(sys.argv[3]).write_text('ready');time.sleep(30)"
        process=subprocess.Popen([sys.executable,'-c',code,str(ROOT/'tools/tarot-bulk-loader'),str(self.folder),str(flag)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        try:
            deadline=time.monotonic()+5
            while not flag.exists() and process.poll() is None and time.monotonic()<deadline:time.sleep(0.01)
            self.assertTrue(flag.exists())
            with self.assertRaises(Stop):
                with exclusive(self.folder):pass
        finally:
            process.kill();process.wait(timeout=5)
        with exclusive(self.folder):pass
    def test_no_consent_no_photo(self):
        b=self.batch()
        with self.assertRaises(Stop):b.run(False,self.stop,lambda *a:None)
        self.assertEqual(len(self.sends()),0)
    def test_false_registry_duplicate_ids_rejected(self):
        b=self.batch()
        for i,e in enumerate(b.state['entries'][:2]):e.update(status='acknowledged',ack=self.ack(self.rows[0],10+i))
        b.save()
        with self.assertRaises(Stop):self.batch()


def fault_test(fault):
    def run(self):
        b=self.batch()
        if fault=='duplicate':
            b.state['entries'][0].update(status='acknowledged',ack=self.ack(self.rows[0]));b.save()
        self.fake.fault=fault
        with self.assertRaises(Stop) as error:self.run_batch(b)
        self.assertNotIn(TOKEN,str(error.exception));self.assertEqual(len(self.sends()),1)
        with self.assertRaises(Stop):self.run_batch(self.batch())
        self.assertEqual(len(self.sends()),1)
    return run
for fault in ['network','500','403','bad_ack','wrong_chat','duplicate']:
    setattr(Bulk,'test_no_blind_repeat_'+fault,fault_test(fault))


class Preparation(unittest.TestCase):
    def test_local_preparation_reuses_importer_and_cache_without_reprocessing(self):
        import importlib.util,zipfile
        from unittest.mock import patch
        from bulk_core import prepare_assets
        spec=importlib.util.spec_from_file_location('synthetic_zip_fixtures',ROOT/'tests/tarot-art-private.test.py')
        module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        fixture=module.OptimizedParts();fixture.setUp()
        try:
            manifest={'manifest_version':'astra-author-art-assets-v1','deck_version':'rws78-v1','card_count':78,'art_version':'SYNTHETIC','cards':fixture.cards}
            file=fixture.root/'manifest.json';file.write_text(json.dumps(manifest));parts=[];entries=list(fixture.files.items())
            for i,chunk in enumerate([entries[:39],entries[39:]]):
                path=fixture.root/('part'+str(i)+'.zip');parts.append(path)
                with zipfile.ZipFile(path,'w') as z:
                    for name,data in chunk:z.writestr(name,data)
            assets,meta=prepare_assets(file,parts,fixture.root/'private')
            self.assertEqual(len(items_from_manifest(assets,meta)),156)
            with patch('bulk_core.subprocess.run',side_effect=AssertionError('CACHE MUST NOT REPROCESS')):
                again,meta2=prepare_assets(file,parts,fixture.root/'private')
            self.assertEqual(again,assets);self.assertEqual(meta2,meta)
        finally:fixture.tearDown()


if __name__=='__main__':unittest.main()
