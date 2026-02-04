<h1 align="center">
   Decky Launch Options
</h1>

<p align="center">
   Manage launch options for your games with ease 🍃
</p>

![Screenshot of the Decky Launch Options plugin on the Steam Deck](./assets/screenshot.png)

## Features

- [x] Manage all your most used launch options in one place
- [x] Enable or disable launch options per game
- [x] Enable launch options globally for all games
- [x] Supports different behaviors when a launch option is on or off

## Philosophy

This plugin is part one of my desire to make the best HTPC/Handheld experience easier to access for anyone using Big
Picture.

My HTPC uses a RDNA 3 GPU and frankly it bothers me immensely that AMD won't support FSR4 officially on my card, or on
my
Steam Deck.
Thankfully, thanks to the people working on OptiScaler, it's possible to mod FSR4 in games that support DLSS, XeSS or
FSR3 and it's a huge quality boost!

Modding OptiScaler/Lossless Scaling in games on the Steam Deck is usually done by using launch options which is not very
intuitive for an average user or someone new to PC Gaming (or even me even though I've been working with PCs for most
of my life now).

There's a UX problem for the average user when it comes to interacting with launch options and I don't blame anyone for it. It's just tedious having to work
with them on handheld or controller. 

At the end of the day, an average user simply wants to toggle features for a game easily or even better have them available by default for ALL
games. That's what I aim to solve with this plugin.

Now, being able to enable/disable features quickly is already a huge step. Ideally, what comes next is a way to enable,
disable or edit features from an interface similar to AMD's Adrenalin software. I already tried to achieve something
similar on Windows with Auto Lossless Scaling for an easier Lossless Scaling integration. I think it can be done thanks
to the work of the Open Source community. My goal is to streamline the process and give Steam Big Picture the tools to
offer the best experience
to play games on regardless of your GPU.

## Installation

* [Download](https://github.com/Wurielle/decky-launch-options/releases) `decky-launch-options.zip` and import it
  in Decky Loader
* Or copy the link to `decky-launch-options.zip` and import it in Decky Loader

> **Note:** You might need to enable `Developer mode` in the Decky Loader settings

## How to use

1. Open the plugin tab to manage your launch options
2. Create a launch option
    * Choose whether to enable it by default for all games ("Enable globally" field)
    * Enter a name
    * In the "On" field, enter the launch option when enabled
    * If applicable, in the "Off" field, enter the launch option when disabled
      ![Screenshot of the launch options settings for the plugin](./assets/manage-launch-options.png)
3. On your game page, click on settings and click on **Launch Options**
   ![Screenshot of the settings for a game in Steam](./assets/app-page.png)
4. Enable or disable launch options to your liking
    * If you already had launch options before, they will be placed in the "Original launch options" field and will be
      executed normally. It is recommended to remove the original launch options once you configured all your launch
      options with the plugin.
    * Locally enabled launch options are opt-in
    * Globally enabled launch options are opt-out
      ![Screenshot of the Decky Launch Options plugin on the Steam Deck](./assets/screenshot.png)

## Understanding launch options
Decky Launch Options tries to simplify launch options management by offering a degree of leeway in how you can structure your launch options but it's still important to understand how launch options work to avoid mistakes!

### The `%command%` Placeholder

The `%command%` placeholder represents where your game executable will be inserted in the command chain. Everything before `%command%` becomes a **prefix** (executed before the game), and everything after becomes a **suffix** (passed as arguments to the game).

**Structure example:**
```
[ENV_VARS] [PREFIX_COMMANDS] %command% [GAME_ARGUMENTS]
```

### Simple Examples

Here are recipes for common launch options scenarios.

> **Note:** Please provide `%command%` whenever you can to assure proper detection of command parts. This will also help readbility.

**Environment variables:**
```bash
SteamDeck=1 Foo="Bar baz" %command%
# > SteamDeck=1 Foo="Bar baz" /path/to/game
```

**Prefix command:**
```bash
mangohud %command%
# > mangohud /path/to/game
```

**Game arguments:**
```bash
%command% -novid -nobackground
# > /path/to/game -novid -nobackground
```

### Complex Examples

**Environment variables + prefix:**
```bash
PROTON_NO_ESYNC=1 MANGOHUD_DLSYM=1 ~/lsfg mangohud %command%
# > PROTON_NO_ESYNC=1 MANGOHUD_DLSYM=1 /home/deck/lsfg mangohud /path/to/game
```

**Prefix with arguments + game arguments:**
```bash
gamescope -w 640 -h 400 -W 1280 -H 800 -f -- %command% -novid -nobackground +fps_max 60
# > gamescope -w 640 -h 400 -W 1280 -H 800 -f -- /path/to/game -novid -nobackground +fps_max 60
```

**Combined prefixes with `--`:**
> The `--` (double dash) is a convention that signals "end of options for this command." It's used to separate different prefix commands and their arguments.
```bash
MANGOHUD=1 gamemoderun -- gamescope -w 640 -h 400 -W 1280 -H 800 -f --mangoapp -- %command% -novid -nobackground +fps_max 60
# > MANGOHUD=1 gamemoderun -- gamescope -w 640 -h 400 -W 1280 -H 800 -f --mangoapp -- /path/to/game -novid -nobackground +fps_max 60
```

### How launch options are handled

When multiple launch options are enabled, they are combined intelligently:

1. **All environment variables** are collected and applied
2. **All prefix commands** are chained together using `--` as a separator
3. **All game arguments** (suffixes) are concatenated and passed to the game

**Example with two launch options enabled:**

- Option 1: `MANGOHUD=1 gamemoderun gamescope -r 30 -- %command% -novid`
- Option 2: `PROTON_NO_ESYNC=1 mangohud %command% -nobackground`

**Results in:**
```bash
MANGOHUD=1 PROTON_NO_ESYNC=1 gamemoderun -- gamescope -r 30 -- mangohud -- /path/to/game -novid -nobackground
```

## Integration with Third-Party plugins

If you're a plugin developer and would like to offer an easy one-click button to add your plugin's launch options via Decky Launch Options, you can do so by dispatching the `dlo-add-launch-options` custom event:

```typescript
window.dispatchEvent(new CustomEvent('dlo-add-launch-options', {
   detail: [
      {
         id: 'portal-args',
         name: 'Portal args',
         on: '-novid +cl_showfps 3',
         off: '',
         enableGlobally: false,
      },
      {
         id: 'mangohud-command',
         name: 'MangoHud command',
         on: 'mangohud %command%',
         off: '',
         enableGlobally: false,
      },
      {
         id: 'steam-deck-env',
         name: 'Steam Deck env',
         on: 'SteamDeck=1',
         off: 'SteamDeck=0',
         enableGlobally: true,
      },
   ]
}));
```

This will prompt the user to review and confirm the provided launch options.

You can also check if Decky Launch Options is available with:
```typescript
(window as any).hasDeckyLaunchOptions
```

> **Note:** Every field of a launch option is optional but I recommend setting a unique id that doesn't change over time to allow Decky Launch Options to update these launch options if the user decides to override them.

## Development

This project uses [just](https://github.com/casey/just) as an IDE-agnostic task runner.

### Pre-requisites:

* [Docker Engine](https://docs.docker.com/engine/install/)
* [pnpm](https://pnpm.io/installation#using-npm)
* [just](https://github.com/casey/just)

1. **Configure deployment settings**

   Copy `.env` to `.env.local` and update with your Steam Deck details:
   ```bash
   cp .env .env.local
   ```
   Edit `.env.local` to match your Steam Deck's IP, user, etc.

1. **Set up SSH key authentication (to avoid password prompts)**
   ```bash
   # Generate SSH key if you don't have one
   ssh-keygen -t rsa -b 4096
   
   # Copy your SSH key to the Steam Deck (enter password once)
   ssh-copy-id -p <DECK_PORT> <DECK_USER>@<DECK_IP>

   # Add your SSH key to ssh-agent (run once per session)
   eval "$(ssh-agent -s)"
   ssh-add ~/.ssh/id_rsa
   ```

### Available commands

- `just` - List all available commands

### Debugging

* [Chrome Inspect](chrome://inspect/#devices)
    * Discover network targets
        * <DECK_IP>:8081

---
