Security Considerations for pcapviz


Principals
==========

1. The pcapviz application
2. The nginx proxy
3. An unauthenticated end-user
4. An authenticated API-user
5. The system administrator
6. The software authors
7. The software storage and deployment system
8. The flow analysis/packet analysis/labeling system (aka data source
   host)
9. Sources of traffic to analyze
19. Systems capturing traffic to analyze

System diagram
==============

                            packets
    [ 9. trafic sources ]  --------> [ 10. capture systems ]
                                                 |
                        git/ssh                  | p
          [6. authors] <------->  [ 7. gitrepo ] | c
                    |                            | a
                    |g/s                         | p
                    |i/s                         | s
    [ 5. sysadmin ] |t/h      annotated          |
           |ssh     |          traffic           |
           v        v           data             v
          [ 1. pcapviz ]   <------------  [ 8. labeling system ]
                 ^    ^     ------------>
                 |http|       http(s)
                 v    v
              [ 2. nginx ]
                 ^    ^
                 |h   |h
                 |t   |t
                 |t   |t
                 |p   |p
                 |s   |s
                 v    |
     [ 3. end-user ]  v
       [ 4. auth-api-user ]


System Boundary
===============

The considerations in this document are primarily concerned with
pcapviz itself and the adjacent systems with which it communicates:
principals 1-8.

Principals 9 and 10 (traffic sources and capture systems) are listed
as sources of potentially harmful content, but are well outside the
system boundary.

The labeling system is considered as a source and destination of
traffic from pcapviz, but its handling of data from the capture system
and its interaction with its users, environment, etc., are not
considered. The safety of pcapviz is not predicated on any filtering
property of the labeling system preventing harmful data (such as from
within a malformed packet capture) from reaching pcapviz.

Similarly, underlying infrastructure such as power, DNS, IP routing,
and vm hosting are contemplated, but not assumed to operate in a way
that contributes positively to the safe operation of pcapviz.


Adversary Powers Considered
===========================

1. Publish packet captures or packet flow files.
2. Send traffic to a system collecting packet captures or flow data.
3. Submit packet capture or flow files to pcapviz
4. Submit HTTP requests to pcapviz
5. Alter/Block/Spoof traffic between pcapviz and an end-user or API-user
6. Alter/Block/Spoof traffic between pcapviz and a data source host
7. Alter/Block/Spoof traffic between pcapviz and the deployment system
8. Operate software on the same hardware as pcapviz
9. Falsify DNS or routing information for any principal
10. Introduce vulnerabilities into software used by any principal
11. Modify in-browser cookie state

Unacceptable losses
===================

1. Loss of control-flow integrity on pcapviz host
2. Loss of availability of pcapviz
3. pcapviz sends unwanted traffic to a remote host
4. pcapviz demands too much bandwidth from a remote host
5. Harmful content appears in the end-user's browser
6. Harmful content is sent to the api user
7. Harmful content is sent to the labeling system by pcapviz


Controls
========

Software deployment
-------------------

The software running on the pcapviz host is from many sources. pcapviz
itself is authored by the its authorship team, but it depends on
resources such as Amazon Linux, NodeJS, the Node libraries listed in
the package.json file, nginx, etc. Each of these other software
systems may introduce unknown and unsafe component interactions.

Some attempts are made to control for a few of these. `yum` is used to
keep Amazon Linux updated. Node libraries are fetched using
`npm`. Each of these has controls for integrity, but neither has a
perfect track record of invulnerability. Any of these components could
lead to a loss.

pcapviz itself is authored on author-owned computers which have
third-party software with known vulnerabilities. It is possible for
these vulnerabilities to lead to unintended code being committed to
the source code repository. Source code is managed with git. The
nature of git's change tracking algorithm is such that alterations of
code from outside of git would be detectable through hash mismatches,
but changes made by subverting an authorized author's (6) local `git`
session would not be.

In the authorship process, changes to pcapviz are pushed to an
external git repository (Georgia Tech's github for now, the public
github eventually) and to a bare git repository on the pcapviz
host. All of these pushes occur over authenticated connections, either
https or ssh. The author is authenticated and the contents of their
submissions are protected against tampering in transit.

On the pcapviz host there is a second git repository that fetches from
the local bare repository in order to affect the deployed software. In
that repository, `git checkout` is used to select a tagged version to
execute. For debugging purposes a person who is both system
administrator (5) and author (6) is able to edit the running
software. These changes are rolled back by human-enforced policy.

Local Proxy and HTTP(s) traffic
----------------------------

In order to protect traffic to and from pcapviz from unauthorized
modification, most, but not all, of its operational communications are
over HTTPS. This is achieved through the use of an nginx proxy using a
Let's Encrypt certificate. Local traffic between nginx and the node
process running pcapviz is over HTTP on the loopback interface. pcapviz
binds only to the configured IP address. If the configuration is left
in the default state, node will be unable to receive traffic except
over the loopback interface, and nginx will be unable to proxy traffic
except to node over that interface. Changes to nginx or pcapviz
configuration can alter this control and make it ineffective.

There are two intentional exceptions where unauthenticated HTTP can be
used. The first is the nginx redirect system that accepts HTTP
connections and sends back a redirection to use HTTPS. The second is
the provision that allows data to be fetched from labeling systems
over HTTP. This means that adversaries can modify both the requests
sent by pcapviz to the labeling system, and responses sent by the
labeling system. Removing this option would improve the security of
the system.

The private keys used for TLS are stored on disk and loaded into nginx
memory. Unauthorized file system or memory access could cause these to
be lost to an adversary. Mechanisms for such access include VM-to-VM
attacks from another virtual machine on the same host, remote code
execution vulnerabilities in system services or pcapviz, loss of the
system administrator ssh keys, etc. These risks are partially
mitigated by the short validity window of the TLS certificates.

Web Application State and Browser Protection
--------------------------------------------

No server-side session state is maintained. The pcapviz service uses
cookies, but only set and read from within the browser, never used by
the server itself. These cookies are only used to retain user viewing
preferences and expire at the end of the browser session. Loss of or
damage to these cookies can result in unexpected rendering glitches,
but will not harm the server. The cookies can be cleared at any time
with no unacceptable loss.

HTML content served to end-users is generated using a DOM-based
template library that avoids the pitfalls of [context-sensitive
escaping](https://github.com/OWASP/CheatSheetSeries/blob/master/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.md)
by only adding content using DOM methods. This alters the structure of
the document but does not expose adversary-controlled input to the
HTML, JavaScript, or CSS parsers. This controls for loss #5.

JSON content is similarly generated not by manual string construction,
but by the use of `JSON.stringify` on actual JavaScript objects. This
provides similar protections for JSON parsers. This controls for
losses #5 and #6.

Unauthenticated Operation
-------------------------

Most users of pcapviz are expected to be unauthenticated end users
using a web browser to interact with the site over https. They will
interact with their browsers which will send traffic to the ngix proxy
on the pcapviz server. TLS will be used for the browser to verify the
identity of the server, but client certificates will not be used so
the browser cannot verify the identity of the end-user.

These users can browse data that is already loaded into pcapviz. The
system exposes endpoints for these https requests that are designed to
minimize the ability to alter server state. The state changes in
response to these unauthenticated requests are limited to: incidental
LRU cache additions and removals of intermediate calculations used in
generating responses, logging of traffic and errors.

Of course these requests also cause the consumption of sockets between
the end-user and nginx and between nginx and the node service. It is
possible for a large volume of requests to consume sufficient file
handles on the server so as to impact availability for future
requests.

No unauthenticated requests should cause pcapviz to issue network
connections to other systems, to write to files other that its own log
streams, or to execute other processes. In order for any of these to
occur, the incoming request would have to exploit a vulnerability
outside of the control of pcapviz, such as by sending a malformed HTTP
request that exploits a buffer overflow in one of the parsing
libraries. pcapviz itself does not perform these actions in response
to unauthenticated requests, to control for loss #1.

One unauthenticated end-point is able to cause pcapviz to send large
quantities of data: namely the record downloader. Exposing this
function does create a risk that pcpviz will consume too much
bandwidth, increasing hosting costs or slowing other requests. It may
be disabled or modified to require authentication in a future release.

Many different sorts of requests can cause pcapviz to read from disk,
including to serve static files. The code for processing these
requests limits the loading of each file type to a specific directory
and prevents the use of path-traversal characters in file names. A
more robust system would white-list file name characters. This is an
area for future work.


Authenticated Operation
-----------------------

Several of the actions pcapviz exposes are able to alter its
state. These include adding or modifying data set definitions,
deleting data sets, or requesting data set reload. Adding, modifying,
or reloading datasets will alter the internal state of the
application, and can cause http or https requests to be issued.

Because of these factors, all of these API endpoints first verify that
the key parts of the request are A) signed by a known authorized key,
and B) that the signatures match the contents of the request. The
authentication system used is from the
[http-signature](https://tools.ietf.org/html/draft-cavage-http-signatures-10)
IETF draft. It is a work in progress, but sufficient for the needs of
pcapviz as-is. The authentication system helps control for losses #1,
#2, #3, #4, #6, and #7.

The authorization system itself must read from disk to fetch the
identified public key. Care is taken to ensure that the key names are
sanitized, but this could be made more robust. The keys are read for
each authorization in order to allow for key revocation by file
deletion and to avoid time-of-check vs time-of-user errors.

Requests for authorization will cause expensive CPU operations to be
performed in order to complete the public-key signature
verification. Sufficiently many requests would cause a loss of
availability (loss #2). Rate limiting is a future option should this prove
problematic.

The API end points that cause requests to be issued to supposed
analysis systems could be improved in several ways. The use of https
could be enforced. An outbound request destination allow-list could be
employed. An outbound request rate limiter could be
implemented. Instead, these risks are controlled for by the
authentication barrier. Only trusted users or users who have obtained
the private keys of trusted users can trigger these requests, which
controls for losses #2, #3, #4, and #7.

The responses to requests for packet or flow data are often very
large. The parsing system is a simple state machine to control for
losses #1 and #2. The API that triggers the requests rejects any
malformed input definitions and the parser that processes the
responses rejects any malformed packet or flow data. The data types
supported are IP addresses, port numbers, label strings, and an
arbitrary textual identifier. The identifier is only exposed when
downloading the full packet/flow record set. The label strings are
operated on as a bit field expect when they are converted back to text
in the user interface. These are intended to control for losses #1,
#2, #5, #6.



Conclusion
==========

pcapviz is designed to be uncomplicated and analyzable by humans. No
home-grown cryptography is used. TLS is used for all end-user
communication. No assumptions were made about the trustworthiness of
data loaded from any http request issued by pcapviz.  The largest
risks remaining are caused by the third-party
dependencies. Controlling for these risks is impractical as it would
require authoring a complete operating system, networking stack, and
web application stack.

Where possible, controls have either been implemented or explicitly
rejected and documented. Choices which would increase risk were made
with great care. Many options for increased user-interface flexibility
or data ingest flexibility were rejected in order to control for the
unacceptable losses listed above. For example, the template system is
harder to use than the one that comes with the Express web application
framework, but it lacks the cross-site scripting vulnerabilities of
that framework.
