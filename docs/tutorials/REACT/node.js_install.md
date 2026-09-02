# Install Node.js on a Mac

A short guide for people who have never installed Node.js.

If you can download an app and type a command in Terminal, you can follow this.

---

## What you are installing

**Node.js** lets you run JavaScript on your computer (not only in a web browser). Tools like React, Vite, and `npm` expect Node to be there.

**npm** (Node Package Manager) is included with Node. You use it to install libraries (`npm install`) and run project scripts (`npm run dev`).

You want the **LTS** (Long Term Support) version. It is the stable one. Skip “Current” unless a tutorial specifically asks for it.

---

## 1. See if Node is already installed

Open **Terminal**:

1. Press `Command + Space` (Spotlight).
2. Type `Terminal` and press Return.

Then run:

```bash
node -v
npm -v
```

**If you see version numbers** (for example `v22.11.0` and `10.9.0`), Node is already installed. You can stop here unless you need a newer version.

**If you see `command not found`**, keep going.

---

## 2. Recommended: install from the official website

This is the simplest method. It uses an installer, like any other Mac app.

### Download

1. Open [https://nodejs.org](https://nodejs.org).
2. Click the big **LTS** button (not Current).
3. Save the `.pkg` file.

The site usually picks the right chip for you (**Apple silicon** on M1/M2/M3/M4 Macs, **x64** on older Intel Macs). If you are not sure which Mac you have: Apple menu → **About This Mac**. “Chip” will say Apple or Intel.

### Run the installer

1. Open the downloaded `.pkg` file.
2. Click **Continue** through the screens.
3. Agree to the license.
4. Keep the default install location.
5. Enter your Mac password if asked.
6. Click **Install**, then **Close** when it finishes.

You can delete the `.pkg` file afterward. It is only the installer.

### Confirm it worked

**Quit Terminal completely** (Terminal menu → Quit Terminal), then open a **new** Terminal window. Old windows may not see the new program.

```bash
node -v
npm -v
```

You should see two version numbers. That means the install succeeded.

Try a tiny check:

```bash
node -e "console.log('Hello from Node')"
```

You should see `Hello from Node`.

---

## 3. Alternative: install with Homebrew

Use this if you already use [Homebrew](https://brew.sh) and prefer the command line.

Check for Homebrew:

```bash
brew --version
```

If that fails, install Homebrew from [https://brew.sh](https://brew.sh) first (the site shows one command to paste). Then:

```bash
brew update
brew install node
```

Homebrew’s `node` formula tracks a current stable Node. For an LTS-focused install, many people use:

```bash
brew install node@22
```

(Use the LTS major version listed in `brew search node` if `22` is no longer LTS.)

Then verify with `node -v` and `npm -v` in a **new** Terminal window.

Do **not** mix a website `.pkg` install and Homebrew Node on purpose. Pick one method so you do not end up with two copies and a confusing `node -v`.

---

## 4. What “success” looks like

| Check | Healthy result |
| --- | --- |
| `node -v` | A version like `v22.x.x` (or another LTS) |
| `npm -v` | A version like `10.x.x` |
| `which node` | A path such as `/usr/local/bin/node` or `/opt/homebrew/bin/node` |

`which node` tells you **which** Node the terminal is using. That is useful if something still says `command not found`.

---

## 5. Common problems

### `command not found: node` after installing

1. Fully quit Terminal and open it again.
2. Run `which node`.
3. If you installed with Homebrew on Apple silicon, your shell may need Homebrew on the PATH. Homebrew usually prints the exact two lines to add to `~/.zprofile` after `brew install`. Paste those, save, then open a new Terminal.

### The installer asks for a password

That is normal. It is your **Mac login** password, not a Node.js account.

### `npm` permission / `EACCES` errors

Do **not** fix this with `sudo npm install`. Installing packages with `sudo` causes harder problems later.

For everyday work, stay in a project folder and run:

```bash
npm install
```

If a global install (`npm install -g ...`) fails on permissions, use a version manager (section 6) or follow npm’s official [fixing npm permissions](https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally) guide.

### macOS blocked the installer

System Settings → **Privacy & Security**, scroll down, and allow the Node installer if macOS quarantined it. Or right-click the `.pkg` → **Open**.

---

## 6. Optional: several Node versions (`nvm`)

Skip this on day one. Come back if a project needs an older or newer Node than the one you installed.

[nvm](https://github.com/nvm-sh/nvm) lets you install and switch versions:

```bash
nvm install --lts
nvm use --lts
node -v
```

If you install nvm, use it **instead of** the `.pkg` / Homebrew Node as your daily Node, so versions do not fight.

---

## Mini checklist

1. Open Terminal and run `node -v`. If it already works, you are done.
2. Download **LTS** from [nodejs.org](https://nodejs.org) and run the `.pkg`.
3. Quit Terminal, open it again, run `node -v` and `npm -v`.
4. Run `node -e "console.log('Hello from Node')"`.

When those four steps work, you can follow any tutorial that says “install Node first.”
