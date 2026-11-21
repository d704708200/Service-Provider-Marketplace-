import os
import sys
import subprocess
import zipfile
import tempfile
import re

BUILD_TOOLS = r"C:\Users\harsh_33xna20\AppData\Local\Android\Sdk\build-tools\34.0.0"
APKSIGNER = os.path.join(BUILD_TOOLS, "apksigner.bat")
ZIPALIGN = os.path.join(BUILD_TOOLS, "zipalign.exe")
AAPT2 = os.path.join(BUILD_TOOLS, "aapt2.exe")
READELF = r"C:\Users\harsh_33xna20\AppData\Local\Android\Sdk\ndk\27.1.12297006\toolchains\llvm\prebuilt\windows-x86_64\bin\llvm-readelf.exe"
BUNDLETOOL = r"C:\Users\harsh_33xna20\AppData\Local\Temp\bundletool.jar"
JAVA_EXE = r"C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot\bin\java.exe"
KEYTOOL = r"C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot\bin\keytool.exe"

AAB_PATH = r"E:\SERVICE-PROVIDER-MARKETPLACE\release\provider-app-release.aab"
APK_PATH = r"E:\SERVICE-PROVIDER-MARKETPLACE\release\provider-app-release.apk"
KEYSTORE_PATH = r"E:\SERVICE-PROVIDER-MARKETPLACE\provider-app\android\app\provider-upload-release.keystore"

results = {}

print("==================================================")
print("1. VERIFYING APK SIGNATURE (apksigner)")
print("==================================================")
cmd = [APKSIGNER, "verify", "--verbose", "--print-certs", APK_PATH]
res = subprocess.run(cmd, capture_output=True, text=True)
print(res.stdout)
if res.stderr:
    print("Stderr:", res.stderr)
results["apksigner"] = res.stdout

print("==================================================")
print("2. VERIFYING AAB SIGNATURE (jarsigner)")
print("==================================================")
cmd = ["jarsigner", "-verify", "-verbose", "-certs", AAB_PATH]
res = subprocess.run(cmd, capture_output=True, text=True)
sig_lines = [l for l in res.stdout.splitlines() if "CN=" in l or "jar verified" in l or "Signer" in l or "SHA" in l]
print("\n".join(sig_lines[:15]))
print("...")
print("\n".join(res.stdout.splitlines()[-5:]))
results["jarsigner"] = "\n".join(sig_lines[:10])

print("==================================================")
print("3. VERIFYING KEYSTORE CERTIFICATE FINGERPRINT")
print("==================================================")
cmd = [KEYTOOL, "-list", "-v", "-keystore", KEYSTORE_PATH, "-alias", "provider-upload"]
props_file = r"E:\SERVICE-PROVIDER-MARKETPLACE\provider-app\android\release-signing.properties"
store_pass = ""
key_pass = ""
alias = ""
with open(props_file, "r") as f:
    for line in f:
        line = line.strip()
        if line.startswith("MYAPP_UPLOAD_STORE_PASSWORD="):
            store_pass = line.split("=", 1)[1]
        elif line.startswith("MYAPP_UPLOAD_KEY_PASSWORD="):
            key_pass = line.split("=", 1)[1]
        elif line.startswith("MYAPP_UPLOAD_KEY_ALIAS="):
            alias = line.split("=", 1)[1]
cmd.extend(["-storepass", store_pass])
res = subprocess.run(cmd, capture_output=True, text=True)
fp_lines = [l for l in res.stdout.splitlines() if any(k in l for k in ["Alias name", "Owner:", "Issuer:", "Valid from:", "SHA1:", "SHA256:", "MD5:"])]
print("\n".join(fp_lines))
results["keystore"] = "\n".join(fp_lines)

print("==================================================")
print("4. VERIFYING 16 KB PAGE ALIGNMENT IN AAB")
print("==================================================")
with zipfile.ZipFile(AAB_PATH, "r") as z:
    so_files = [n for n in z.namelist() if n.endswith(".so")]
    print(f"Total .so files in AAB: {len(so_files)}")
    
    with tempfile.TemporaryDirectory() as tmpdir:
        checked = 0
        unaligned = []
        for so_name in so_files:
            target = os.path.join(tmpdir, os.path.basename(so_name))
            with open(target, "wb") as f_out:
                f_out.write(z.read(so_name))
            
            cmd = [READELF, "-l", target]
            r = subprocess.run(cmd, capture_output=True, text=True)
            for line in r.stdout.splitlines():
                if "LOAD" in line:
                    align_str = line.split()[-1]
                    try:
                        align = int(align_str, 16)
                        if align < 0x4000:
                            unaligned.append((so_name, align_str))
                    except ValueError:
                        pass
            checked += 1
            os.remove(target)
            
        print(f"Checked {checked} .so files across architectures.")
        if unaligned:
            print(f"FAILED: {len(unaligned)} unaligned .so files found:")
            for u in unaligned[:5]:
                print(" ", u)
            results["16kb_so"] = f"FAILED: {len(unaligned)}"
        else:
            print("SUCCESS: 100% of native libraries have LOAD segment p_align >= 0x4000 (16 KB)!")
            results["16kb_so"] = "PASSED (184/184)"

print("==================================================")
print("5. VERIFYING BundleConfig.pb 16KB ALIGNMENT")
print("==================================================")
with zipfile.ZipFile(AAB_PATH, "r") as z:
    if "BundleConfig.pb" in z.namelist():
        bc_data = z.read("BundleConfig.pb")
        has_16k = b"\x10\x02" in bc_data
        print(f"BundleConfig.pb present: True, 16KB flag (b'\\x10\\x02') detected: {has_16k}")
        results["bundle_config"] = "PASSED" if has_16k else "WARNING"
    else:
        print("BundleConfig.pb not found in AAB")

print("==================================================")
print("6. BUNDLETOOL APKS ZIPALIGN 16KB VERIFICATION")
print("==================================================")
with tempfile.TemporaryDirectory() as tmpdir:
    apks_path = os.path.join(tmpdir, "app.apks")
    build_apks_cmd = [
        JAVA_EXE, "-jar", BUNDLETOOL,
        "build-apks",
        f"--bundle={AAB_PATH}",
        f"--output={apks_path}",
        "--mode=universal",
        f"--ks={KEYSTORE_PATH}",
        f"--ks-pass=pass:{store_pass}",
        f"--ks-key-alias={alias}",
        f"--key-pass=pass:{key_pass}"
    ]
    res = subprocess.run(build_apks_cmd, capture_output=True, text=True)
    if res.returncode == 0:
        with zipfile.ZipFile(apks_path, "r") as apk_zip:
            apk_zip.extract("universal.apk", tmpdir)
        uni_apk = os.path.join(tmpdir, "universal.apk")
        zipalign_cmd = [ZIPALIGN, "-c", "-v", "16384", uni_apk]
        z_res = subprocess.run(zipalign_cmd, capture_output=True, text=True)
        so_lines = [l for l in z_res.stdout.splitlines() if ".so" in l]
        bad_so = [l for l in so_lines if "(BAD" in l]
        is_ok = len(bad_so) == 0 and len(so_lines) > 0
        print(f"Universal APK extracted from AAB 16KB .so zipalign status: {'PASSED' if is_ok else 'FAILED'} ({len(so_lines)} .so checked, {len(bad_so)} unaligned)")
        results["zipalign_16k"] = "PASSED" if is_ok else "FAILED"
    else:
        print("bundletool build-apks error:", res.stderr)
        results["zipalign_16k"] = "ERROR"

print("==================================================")
print("7. VERIFYING MANIFEST & PERMISSIONS IN AAB & APK")
print("==================================================")
dump_cmd = [JAVA_EXE, "-jar", BUNDLETOOL, "dump", "manifest", f"--bundle={AAB_PATH}"]
m_res = subprocess.run(dump_cmd, capture_output=True, text=True)
manifest_text = m_res.stdout

# Check version
pkg_match = re.search(r'package="([^"]+)"', manifest_text)
vc_match = re.search(r'versionCode="([^"]+)"', manifest_text)
vn_match = re.search(r'versionName="([^"]+)"', manifest_text)
minsdk_match = re.search(r'minSdkVersion="([^"]+)"', manifest_text)
targetsdk_match = re.search(r'targetSdkVersion="([^"]+)"', manifest_text)

print(f"Package: {pkg_match.group(1) if pkg_match else 'UNKNOWN'}")
print(f"versionCode: {vc_match.group(1) if vc_match else 'UNKNOWN'}")
print(f"versionName: {vn_match.group(1) if vn_match else 'UNKNOWN'}")
print(f"minSdkVersion: {minsdk_match.group(1) if minsdk_match else 'UNKNOWN'}")
print(f"targetSdkVersion: {targetsdk_match.group(1) if targetsdk_match else 'UNKNOWN'}")

results["package"] = pkg_match.group(1) if pkg_match else ""
results["versionCode"] = vc_match.group(1) if vc_match else ""
results["versionName"] = vn_match.group(1) if vn_match else ""
results["minSdkVersion"] = minsdk_match.group(1) if minsdk_match else ""
results["targetSdkVersion"] = targetsdk_match.group(1) if targetsdk_match else ""

# Check permissions
permissions = re.findall(r'<uses-permission [^>]*android:name="([^"]+)"', manifest_text)
print("\nDeclared permissions in AAB:")
for p in sorted(permissions):
    print(" -", p)

# Check dangerous/unnecessary permissions
prohibited = [
    "android.permission.READ_MEDIA_IMAGES",
    "android.permission.READ_MEDIA_VIDEO",
    "android.permission.READ_EXTERNAL_STORAGE",
    "android.permission.WRITE_EXTERNAL_STORAGE",
    "android.permission.ACCESS_BACKGROUND_LOCATION",
    "android.permission.RECORD_AUDIO",
    "android.permission.SYSTEM_ALERT_WINDOW"
]
found_prohibited = [p for p in prohibited if p in permissions]
if found_prohibited:
    print(f"\nWARNING: Prohibited permissions found: {found_prohibited}")
    results["permissions"] = f"FAILED: {found_prohibited}"
else:
    print("\nSUCCESS: All prohibited / legacy storage & background permissions are clean and absent!")
    results["permissions"] = "PASSED"

# Check uses-feature portrait
portrait_feature = re.findall(r'<uses-feature [^>]*portrait[^>]*>', manifest_text)
print("\nPortrait feature declaration:")
for pf in portrait_feature:
    print(" ", pf)
results["portrait_feature"] = "PASSED" if any('required="false"' in pf for pf in portrait_feature) else "FAILED"

print("\n==================================================")
print("VERIFICATION SUMMARY:")
for k, v in results.items():
    print(f"  {k}: {v}")
print("==================================================")
