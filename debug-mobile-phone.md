# 1. Debug on your device
 
1. On the PC, run the server: `python serve.py`.
2. Run `ipconfig` and note the Wi-Fi IPv4 address.
3. Make sure the phone on the same Wi-Fi and open `http://<that-IP>:8000`.
4. If it doesn't load, allow Python through the Windows firewall.

For the phone console, use Chrome `chrome://inspect` over USB (Android) or eruda.


# 2. Real & Simulators


## a. Phone Simulator – Free Mobile Simulator Chrome Extension  
https://phone-simulator.com/https://phone-simulator.com/  


## b. 
| Option | Rating (/5) | Why |
| :--- | :---: | :--- |
| **[BrowserStack](https://www.browserstack.com/)** | **5 / 5** | Runs on real physical iPhones and real macOS Safari in the cloud (limited trial minutes). |
| **[Sauce Labs](https://saucelabs.com/)** | **4.5 / 5** | Trial includes real iOS devices + simulators and macOS Safari. |
| **[Apple Xcode](https://developer.apple.com/xcode/)** | **4 / 5** | Official iOS Safari stack, but runs on Mac hardware rather than physical iPhone CPU/GPU/sensors (Mac required). |
| **[LambdaTest](https://www.lambdatest.com/)** | **3.5 / 5** | Free tier relies mostly on cloud iOS simulators and VMs rather than physical iPhones. |
| **[Playwright](https://playwright.dev/)** | **3 / 5** | Uses the real WebKit engine, but on Windows it lacks iOS/macOS fonts, Safari UI, audio/media codecs, and touch behavior. |

