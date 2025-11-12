# PayAttn Browser Extension

Privacy-first ad agent that runs autonomously in the background.

## Quick Install (Development Mode)

### Chrome/Edge:
1. Open `chrome://extensions/` in your browser
2. Enable **"Developer mode"** (toggle in top-right corner)
3. Click **"Load unpacked"**
4. Select this `extension` folder
5. Done! ✅ The extension is now installed and running

### Firefox:
1. Open `about:debugging#/runtime/this-firefox`
2. Click **"Load Temporary Add-on"**
3. Select the `manifest.json` file from this folder
4. Done! ✅

## ⚙ How It Works

### Background Processing:
- **Runs every 30 minutes** automatically using Chrome Alarms API
- **Continues running** even when browser tabs are closed
- **Full privacy**: All data stays in your browser

### Storage (IndexedDB):
- Uses **IndexedDB** (shared between website and extension)
- Website saves profiles → Extension reads same data
- Both use the same encrypted storage
- **No server storage** - everything stays local

### Manual Control:
- Click the extension icon to see status
- Press "Run Now" to trigger processing immediately
- View execution logs

## Syncing with Web Dashboard

The extension shares IndexedDB storage with the web dashboard at `localhost:3000/storage-test`:

1. Visit website → Create/edit your profile
2. Profile saved to IndexedDB (encrypted)
3. Extension automatically reads from same IndexedDB
4. Both interfaces see the same data instantly

**No manual sync needed!** They share the same database.

## Next Steps

1. **Test the basic extension**: Install it and check that it runs
2. **Integrate crypto functions**: Copy your `crypto-pure.ts` logic into `background.js`
3. **Add ZK proof generation**: Implement the actual ad processing logic
4. **Connect to your backend**: Add API calls to fetch ads and submit bids

## 🐛 Debugging

- Open `chrome://extensions/`
- Click "background page" under your extension
- See console logs from `background.js`

## For Production

When ready to publish:
1. Test thoroughly in dev mode
2. Create icons (replace the placeholder ones)
3. Update `manifest.json` with final URLs
4. Zip the extension folder
5. Submit to Chrome Web Store

---

**Status**: MVP ready for local testing! 🎉
