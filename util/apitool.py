#!/usr/bin/env python
import requests
from requests_http_signature import HTTPSignatureAuth
import sys
import warnings
from cryptography.utils import CryptographyDeprecationWarning

# the requests_http_signature module uses the old name for some functions
# the following line stops that warning from appearing on every invocation
warnings.filterwarnings('ignore', category=CryptographyDeprecationWarning)


#TODO: don't require users to know the URL endpoints:
#      instead, take the base_url as a param and the data set name as
#      a separate parameter
#TODO: Consider adding an option to fetch an input definition or check its
#      status using the existing unauthenticated APIs
def usage():
  print('''USAGE:
apitool.py keyid:path/to/key check BASE_URL
apitool.py keyid:path/to/key reload URL
apitool.py keyid:path/to/key update URL JSON
apitool.py keyid:path/to/key delete URL
  ''');
  exit(1)

#TODO: use a parameter parsing library, this is awful
if len(sys.argv)<4 or sys.argv[1] == '-h' or sys.argv[1] == '--help':
  usage()


(keyid,keyfilepath) = sys.argv[1].split(':');
action = sys.argv[2];

if action == 'update' and len(sys.argv)<5 :
  usage()

url = sys.argv[3]
if url.endswith("/"):
  url = url[:-1]

# some APIs check the body digest, others (bodyless) don't
date_digest_target= ['date','digest','(request-target)']
date_target= ['date','(request-target)']

with open(keyfilepath, 'rb') as fh:
  # define the authentication options for the http requests
  auth=HTTPSignatureAuth(algorithm="rsa-sha256",
                         key=fh.read(),
                         key_id=keyid,
                         headers=date_target if action != 'update' else date_digest_target)
  res = {'content': "No request sent"}
  if action == 'reload':
    res = requests.post(url+'/reload', auth=auth)
  if action == 'update':
    res=requests.put(url, data=(sys.argv[4]).encode('ascii'), auth=auth)
  if action == 'delete':
    res=requests.delete(url, auth=auth)
  if action == 'check':
    res=requests.post(url+'/auth_check', auth=auth)
  print(res.content)
