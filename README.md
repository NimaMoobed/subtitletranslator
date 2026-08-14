# SUB/SHIFT

Translate `.srt` and text-based `.sub` subtitle files between languages without changing their timestamps. The project is public, browser-first, bilingual (English/Persian), and designed so people can use a free engine or bring their own translation provider.

**Live app:** [nimamoobed.github.io/subtitletranslator](https://nimamoobed.github.io/subtitletranslator/)  
**نسخه فارسی:** [nimamoobed.github.io/subtitletranslator/fa](https://nimamoobed.github.io/subtitletranslator/fa/)  
**Created by:** [Nima Moobed](https://nmoobed.com/?utm_source=github&utm_medium=readme&utm_campaign=subshift)

## What it does

- Any supported source language → any supported target language
- Parses SRT, MicroDVD SUB, and SubViewer text files locally
- Preserves every timestamp and cue ID
- Exports UTF-8 with BOM for VLC, PotPlayer, and other players
- Handles right-to-left preview for Persian, Arabic, Urdu, and Hebrew
- Offers natural, cinematic, and literal subtitle styles with AI providers
- Sends dialogue text only; timestamps never go to a provider
- Includes privacy-safe analytics events without subtitle text or API keys

## Translation engines

| Engine | Key | Notes |
|---|---:|---|
| Chrome on-device | No | Free and private. Desktop Chrome and supported language pairs only. |
| MyMemory | No | Free public allowance; best for smaller files and has daily limits. |
| Google Gemini | Yes | Model name is configurable. |
| OpenAI | Yes | Uses Structured Outputs to keep cue IDs aligned. |
| Anthropic Claude | Yes | Uses JSON-schema structured output. |
| OpenRouter | Yes | Lets users choose from many compatible models. |
| Google Cloud Translation | Yes | Official NMT API; Google currently includes a monthly free character allowance. |
| LibreTranslate | Optional | Point the app at a self-hosted instance for open-source, unrestricted use. |

There is intentionally no unofficial “unlimited Google Translate” endpoint. Those endpoints are brittle and can violate service terms. The honest unlimited option is a self-hosted LibreTranslate instance.

## Run locally

```bash
npm install
npm run dev
```

Build the static site:

```bash
npm run build
```

No server or environment variables are required. Provider keys are entered by the user, kept in browser memory, and sent directly to the selected provider.

## Deploy your own copy

Fork the repository and enable GitHub Pages with **GitHub Actions** as the source. The included workflow builds and deploys on every push to `main`.

To use your own analytics property, replace `G-J4KZV3D4D8` in `index.html`. Remove the two Google tag scripts if you do not want analytics.

## فارسی

SUB/SHIFT فایل‌های زیرنویس `.srt` و `.sub` متنی را از هر زبان پشتیبانی‌شده به زبان دیگر ترجمه می‌کند، بدون اینکه تایم‌کدها تغییر کنند. رابط کاربری انگلیسی و فارسی است و خروجی با فرمت UTF-8 BOM برای VLC و PotPlayer ساخته می‌شود.

### امکانات

- تشخیص و خواندن SRT، MicroDVD SUB و SubViewer داخل مرورگر
- حفظ کامل شماره دیالوگ‌ها و زمان‌بندی
- پشتیبانی از پیش‌نمایش راست‌به‌چپ
- حالت‌های رایگان Chrome و MyMemory
- اتصال اختیاری OpenAI، Claude، Gemini، OpenRouter، Google Cloud و LibreTranslate
- نگهداری کلید API فقط در حافظه مرورگر
- امکان راه‌اندازی نسخه شخصی و عمومی از طریق GitHub Pages

API عمومی، قانونی و واقعاً نامحدود برای Google Translate وجود ندارد. برای استفاده آزاد و نامحدود، LibreTranslate را روی سرور خودتان اجرا کنید.

## License

[MIT](LICENSE)
