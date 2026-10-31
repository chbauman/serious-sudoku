# Publishing to the Play Store

What is automated and what has to be done by hand.

## One-time setup (by hand)

1. **Developer account**: https://play.google.com/console (one-time fee, identity
   verification). New personal accounts currently have to run a *closed test*
   with a minimum number of testers for some days before production access is
   granted; the Play Console shows the exact requirements.
2. **Create the app** in the Play Console: name `Serious Sudoku`, default language,
   choose *Game*, free. The package name
   `ch.chrisbaumann.sudoku` is fixed by the first upload and cannot be changed
   afterwards.
3. **Upload key**: create it once and keep a backup of the file and the
   passwords (without them you cannot upload updates):

   ```
   keytool -genkeypair -v -keystore upload.keystore -alias upload \
     -keyalg RSA -keysize 2048 -validity 10000
   base64 -w0 upload.keystore > upload.keystore.base64
   ```

   Play App Signing then manages the real app signing key; the upload key can be
   reset via Play support if it is lost.
4. **Repository secrets** (GitHub: Settings -> Secrets and variables -> Actions):

   | Secret | Value |
   | --- | --- |
   | `ANDROID_KEYSTORE_BASE64` | content of `upload.keystore.base64` |
   | `ANDROID_KEYSTORE_PASSWORD` | the keystore password |
   | `ANDROID_KEY_ALIAS` | `upload` (the alias used above) |
   | `ANDROID_KEY_PASSWORD` | the key password |
5. **Store listing**: texts in [`listing.md`](listing.md), graphics in this folder
   (`icon-512.png`, `feature-graphic-1024x500.png`, `screenshots/`), the
   privacy policy is deployed with the website at
   https://chrisbaumann.ch/serious-sudoku/privacy.html (`src/privacy.html`).
   Fill in the content rating, data safety and target audience forms
   (the app collects no data).

## Each release

1. Run the workflow **Android release** (Actions -> Android release -> Run
   workflow, or push a tag like `v1.1`). It runs the tests, builds the web app,
   and produces the signed bundle `serious-sudoku-release-aab`. The version code is
   the run number, so it increases with every build.
2. Download the artifact and upload the `.aab` file in the Play Console
   (Internal testing first, later closed / production). The first upload has to
   be done by hand; later ones could be automated with a Play service account.
