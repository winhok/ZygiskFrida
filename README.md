# ZygiskFrida

> [Frida](https://frida.re) is a dynamic instrumentation toolkit for developers, reverse-engineers, and security researchers

> [Zygisk](https://github.com/topjohnwu/Magisk) part of Magisk allows you to run code in every Android application's Process.


## Introduction

[ZygiskFrida](README.md) is a zygisk module allowing you to inject frida gadget in Android applications in a
more stealthy way.

This project is a fork of [lico-n/ZygiskFrida](https://github.com/lico-n/ZygiskFrida). The bundled WebUI is
based on and adapted from [axelkar/ZygiskFrida-webui](https://github.com/axelkar/ZygiskFrida-webui#), with the
configuration interface integrated directly into the module package.

- The gadget is not embedded into the APK itself. So APK Integrity/Signature checks will still pass.
- The process is not being ptraced like it is with frida-server. Avoiding ptrace based detection.
- Control about the injection time of the gadget.
- Allows you to load multiple arbitrary libraries into the process.

This repo also provides a [Riru](https://github.com/RikkaApps/Riru) flavor in case you are still
using riru with an older magisk version rather than zygisk.

## How to use the module

### Prerequisites
- Rooted device/emulator
- Zygisk available and enabled

### Quick start
- Download the latest release from the [Release Page](https://github.com/lico-n/ZygiskFrida/releases)\
  If you are using riru instead of zygisk choose the riru-release. Otherwise choose the normal version.
- Transfer the ZygiskFrida zip file to your device and install it via Magisk.
- Reboot after install
- Open the module's WebUI from a compatible root manager or [WebUI X](https://github.com/MMRLApp/WebUI-X-Portable), add your target app, and save the configuration.
- Alternatively, create the config file manually and adjust the package name to your target app (replace `your.target.application` in the commands):
```shell
adb shell 'su -c cp /data/local/tmp/re.zyg.fri/config.json.example /data/local/tmp/re.zyg.fri/config.json'
adb shell 'su -c sed -i s/com.example.package/your.target.application/ /data/local/tmp/re.zyg.fri/config.json'
```
- Launch your app. It will pause at startup allowing you to attach
  f.e. `frida -U -N your.target.application` or `frida -U -n Gadget`

This assumes that you don't have any other frida server running (f.e. by using MagiskFrida).
You can still run it together with frida-server but you would have to configure the gadget
to use a different port.

### Configuration

This module also supports adding a start up delay that can delay injection of the gadget to
avoid checks run at startup time, loading arbitrary libraries and child gating.

The bundled WebUI can create and edit the advanced configuration, choose from installed
applications, manage injected library paths, and configure child gating. The configuration is
stored at `/data/local/tmp/re.zyg.fri/config.json`; force-stop and reopen target apps after saving.

Please take a look at the [configuration guide](docs/advanced_config.md) for this.

## How to build

- Checkout the project
- Run `./gradlew :module:assembleRelease`
- The build magisk module should then be in the `out` directory.

You can also build and install the module to your device directly with `./gradlew :module:flashAndRebootZygiskRelease`

## Caveats

- For emulators this will start the gadget in native realm. This means that you will be able to hook Java but not native functions.

## Credits

- Upstream project: [lico-n/ZygiskFrida](https://github.com/lico-n/ZygiskFrida)
- WebUI reference: [axelkar/ZygiskFrida-webui](https://github.com/axelkar/ZygiskFrida-webui#)
- Inspired by [Perfare/Zygisk-Il2CppDumper](https://github.com/Perfare/Zygisk-Il2CppDumper)
- Vendored native library loading dependency: [hexhacking/xDL](https://github.com/hexhacking/xDL)
