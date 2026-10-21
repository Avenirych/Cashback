# Source integrity manifest

Manifest status: **CANDIDATE / NOT APPROVED**

Inventory date: 2026-10-16. Project: `C:\Users\serge\cashback+`.

- Reconstruction status: **UNVERIFIED** (NEW RECONSTRUCTION; not the recovered original G001–G011).
- `_RECONSTRUCTION_REVIEW_APPROVED=False`.
- `NativeIoContractVerified=false`.
- A/C/D: **NOT GRANTED**.
- B: source implementation only; this manifest changes no execution permissions.
- Parent tests: **NOT EXECUTED**; test allowlist remains fixed at 12.
- Previous tests: 57/57 PASS as previously reported; not rerun.
- Provisioning: **BLOCKED**.

## Measurement contract

28 files: 20 Python source files, 6 Windows controller source/project/configuration files, and 2 parent source files. Every entry below is CANDIDATE, not OWNER_APPROVED.

For each file a read-only FileStream with FileShare.Read was opened; Get-FileHash -InputStream -Algorithm SHA256 hashed its original bytes. Size was obtained from that same open stream, with unchanged length and EOF position checked after hashing. No text decoding, newline normalization, execution, snapshot delivery or snapshot storage was used. File entries marked ReparsePoint were rejected. This is not handle-based ancestry verification and does not establish absence of junction/alias or privileged-interference risks. The measurements are per-file, not an atomic multi-file snapshot, and do not guarantee subsequent immutability.

Only this Markdown document was created. No source file, gate, approved-source hash mapping or permission was updated. The manifest excludes itself to avoid a self-referential hash.

## Python integration and fixed source-only dependency set

| Project-relative path | Bytes | SHA-256 |
|---|---:|---|
| `infra/finance-security-test/synthetic-harness/admission.py` | 10788 | `23BEB695F9E75D1F5A42764353A57E64B8A2B782698481DE6FC8B420767C5998` |
| `infra/finance-security-test/synthetic-harness/collector.py` | 21166 | `619AD520D0B36215D43BE7EBB27298094FDCE9FA00B2DC81693C1BE7C370FC83` |
| `infra/finance-security-test/synthetic-harness/contract.py` | 5426 | `3465A29115F0EC2A19E9A5FA99D0DECBAFE8421C1C2C9653648BDD7DD287C9A3` |
| `infra/finance-security-test/synthetic-harness/controller.py` | 6977 | `41C7E4523D8F5082866E05017A00C50EA1827F4A85D5F4422061E100A347AD36` |
| `infra/finance-security-test/synthetic-harness/integration.py` | 19361 | `C47FC12135A8065209AEE9E56BC14712C74FF105D364BED50D974144DBDC2DF9` |
| `infra/finance-security-test/synthetic-harness/oracles.py` | 2368 | `8EFC69F24B1755B808DD3BF360EF6CCD1764A5275066132774D070CC95935DA7` |
| `infra/finance-security-test/synthetic-harness/parent_test_adapter.py` | 11794 | `A745AF134405F42D938791FC9B9B057ED639201A276952D94934102B288ED41A` |
| `infra/finance-security-test/synthetic-harness/parent_test_launcher.py` | 9869 | `1D69E588C7E6E842A757A65B23E8A79CA0C9CC9407EBB5F6B8EFF81C5A7ED171` |
| `infra/finance-security-test/synthetic-harness/protocol.py` | 8637 | `C50F497C05135FE9174D3FCE6EFB0A78AC4445FB6D84446F88883B4923B3E574` |
| `infra/finance-security-test/synthetic-harness/runner_gate.py` | 3725 | `3249C57BAE50704E235B5F994CC9EBF2605188EDBC09828B9144B45202055B7E` |
| `infra/finance-security-test/synthetic-harness/scanner.py` | 5227 | `C11AC0A79BE7D2B9F3F94E4D2DC218BED4C66B2FBE24D19DF052BCF19B56292D` |
| `infra/finance-security-test/synthetic-harness/security_bootstrap.py` | 20373 | `C43FD9BEEC55E1620234D52CA456E38ED2CEF73B772690D2A41D6F6C803F8D79` |
| `infra/finance-security-test/synthetic-harness/targets.py` | 745 | `69CE2855D0D403C96D3AB3D3AFE8646197A9A61DC49DADA7546ED57DDB1DE715` |
| `infra/finance-security-test/synthetic-harness/test_admission_unit.py` | 5370 | `D5177895DBC91A9FC4385625757422D0DA80A0BF69757295730B7C157EE4D743` |
| `infra/finance-security-test/synthetic-harness/test_bounded_stream_unit.py` | 6387 | `596A7AC2FB438C3581AEFE4801E356DCB7E5AAFA43ACDB1BDB6F6C12ADDF997D` |
| `infra/finance-security-test/synthetic-harness/test_oracles_unit.py` | 2551 | `05F6173AED574D3CEAE7ECDA468CADE27ACA16D7C22F64C19488A37F3FFA690A` |
| `infra/finance-security-test/synthetic-harness/test_unit.py` | 9882 | `D0E88A853973596C358334DA600460E785508B4B8E714C15A77981417DF21475` |
| `infra/finance-security-test/synthetic-harness/test_wiring_unit.py` | 12995 | `07FB73C4A18B7EDB026DFF797AAC2D25DE44199C6FAC49BEC24D9D32DDA15060` |
| `infra/finance-security-test/synthetic-harness/test_worker_evidence_unit.py` | 9282 | `35CC8A0EA5EE6982134DB5D03A3E236F73CFE406114AD8711AF8496A61210467` |
| `infra/finance-security-test/synthetic-harness/worker.py` | 6894 | `F2989E4A9A5FF1D0ACC1354B82D79906B0E8126C94728237DD81E8CC521177E0` |

The source-only mapping has 17 module names: admission, collector, contract, controller, integration, oracles, protocol, runner_gate, scanner, targets, worker, test_admission_unit, test_bounded_stream_unit, test_oracles_unit, test_unit, test_wiring_unit, test_worker_evidence_unit. All 17 files are recorded above. The separately loaded parent_test_adapter.py, entry launcher and security bootstrap bring the Python inventory to 20.

Direct parent-test route: parent_test_launcher.py loads the pinned security_bootstrap.py; bootstrap loads parent_test_adapter.py and test_unit.py. test_unit imports contract, scanner and targets. The adapter loads only verified in-memory common.py/provision.py bytes using synthetic import routes. The original targets.load_targets disk-reading path is blocked/replaced in this launcher route.

Transitive mapping dependencies are included conservatively even when not reached by the fixed 12 tests: controller → admission, collector, contract, protocol, integration, oracles; collector → admission, contract, scanner, oracles; integration → runner_gate, contract, scanner, targets; runner_gate → admission, contract; worker → collector, contract, protocol, runner_gate, integration, scanner, oracles. Test-module imports remain within the recorded set. Including their source hashes does not authorize executing additional test classes or integration scenarios.

## Windows controller and local build configuration

| Project-relative path | Bytes | SHA-256 |
|---|---:|---|
| `infra/finance-security-test/synthetic-harness/windows-controller/Cashback.Synthetic.Controller.csproj` | 534 | `73AC607A580B38BDAA5B9D122B4EFE5F02426312BECEB6BAD0E12DC92FA34044` |
| `infra/finance-security-test/synthetic-harness/windows-controller/Controller.cs` | 21091 | `920C060ED7B1CE1EE4D3B7B9BC69176EF49DF99FEF60A36A88E2CA538E291B28` |
| `infra/finance-security-test/synthetic-harness/windows-controller/Native.cs` | 10457 | `3061FCC7A480D1B8509B362D87A4B7136B29FFA4E98449A87FFA50B7BB754A5E` |
| `infra/finance-security-test/synthetic-harness/windows-controller/NuGet.Config` | 194 | `11B3C77662929FE17D2DE835A8C0A9C9399F862F94154541DCD8FE6EB7AF0876` |
| `infra/finance-security-test/synthetic-harness/windows-controller/PipePair.cs` | 10647 | `2565465756BA7B37B98737B61EC82EF6FDA00398A6AA8417908665E1D1FB1008` |
| `infra/finance-security-test/synthetic-harness/windows-controller/Protocol.cs` | 4879 | `120BF00592B729F4F0AE07E97D18FB04DA086BE04652CC5503781C43FAB7454C` |

The project uses Microsoft.NET.Sdk with implicit C# compile items. The four nongenerated C# sources are Controller.cs, Native.cs, PipePair.cs and Protocol.cs. No explicit ProjectReference, PackageReference or custom Import was present in the inspected project. NuGet.Config is included as local build configuration, not as executable source. CBPT1/CBPR1 implementation is covered by the launcher, adapter, bootstrap, Controller.cs and Protocol.cs; protocol.py is also recorded as part of the existing Python harness dependency set.

## Parent files — CANDIDATE only

| Project-relative path | Bytes | SHA-256 |
|---|---:|---|
| `infra/finance-security-test/common.py` | 7558 | `634C1FBCDEE3D5F123901881539A2193B7899CD2053502A12B3152685E3231C0` |
| `infra/finance-security-test/provision.py` | 1666 | `CB9833D4505874CBA4276A74A9AAD268611B5EBED6DDB101882925547DF82A96` |

Both measurements match the previously supplied candidate baseline. Matching hashes do not confer owner approval or authorize capture/execution. These files were hashed, not imported or executed.

## Completeness and exclusions

Static inventory checked local Python import declarations, fixed/dynamic source-module mapping, explicit launcher bootstrap path, adapter parent-snapshot routes, C# source inventory and the controller project file. No missing local Python/C# source dependency was identified in those declared routes. The complete fixed source-only mapping is covered; this is not proof that arbitrary dynamically constructed import or file paths can never exist or execute.

Full dependency completeness cannot be confirmed statically for the entire environment. Python standard library/native runtime, .NET SDK/framework/native Windows libraries, implicit MSBuild ancestor/environment imports, external hosts that may supply authorization/launcher text, and operating-system identity/ABI behavior are not hashed or attested by this document. No MSBuild evaluation or runtime import was performed.

Generated bin/obj files, bytecode/cache, SDK-generated C# sources, binary artifacts and documentation are excluded. This source manifest does not attest the previously compiled DLL or prove it matches current sources. Docker Compose, provisioning SQL and live resources are outside this parent-test integration manifest: generic harness references to sql/00_roles.sql and sql/10_boundary.sql are not permissions to read/execute them; the parent adapter exposes synthetic paths only. No provisioning dependency is approved here.

The raw launcher-file SHA-256 is not automatically proof of the bytes supplied to the controller as a UTF-8 string. Before any separately authorized execution, the exact supplied launcher encoding/content must match its approved hash, without BOM/newline transformations. Any future source or gate/configuration edit invalidates the affected current-file digest and requires a new explicitly authorized integrity update; no hashes are installed into gates by this manifest.

## Remaining execution blockers

- Owner approval of parent baselines and executable source/hash configuration is absent.
- Bootstrap source pin is unset; the approved local-source hash mapping is empty.
- Reconstruction review gate remains false; original G001–G011 equivalence remains UNVERIFIED.
- Native I/O verification gate remains false; EOF/cancellation/handle lifetime behavior has not been established by this inventory.
- Permissions A/C/D remain absent. Neither this manifest nor matching digests grant them.
- No Python/controller, build/restore, tests, Docker/PostgreSQL/SQL, provisioning, network operation or snapshot capture/delivery was run.

Result: **CANDIDATE manifest prepared; execution BLOCKED**.
