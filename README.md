# Decky Launch Options

Manage launch options for your games with ease. 🍃

![Screenshot of the Decky Launch Options plugin on the Steam Deck](./assets/screenshot.png)

## Features

- [x] Manage all your most used launch options in one place
- [x] Enable or disable launch options per game
- [x] Enable launch options globally for all games
- [x] Supports different behaviors when a launch option is on or off

## Philosophy

This plugin is part one of my desire to make the best HTPC/Handheld experience easier to access for anyone using Big
Picture.

My HTPC uses a RDNA 3 GPU and frankly it bothers me immensely that AMD won't support FSR4 officialy on my card, or on my
Steam Deck.
Thankfully, thanks to the people working on OptiScaler, it's possible to mod FSR4 in games that support DLSS, XeSS or
FSR3 and it's a huge quality boost!

Modding OptiScaler/Lossless Scaling in games on the Steam Deck is usually done by using launch options which is not very
intuitive for an every day user or someone new to PC Gaming (even for me even though I've been working with PCs for most
of my life now).

There's a UX problem when it comes to launch options and I don't blame anyone for it. It's just tedious having to work
with it on handheld or controller. I just want to toggle features easily or even better have them available for ALL
games. So that's what I aimed to achieve with this plugin.

Now, being able to enable/disable features quickly is already a huge step. Ideally, what comes next is a way to enable,
disable or edit features from an interface similar to AMD's Adrenalin software. I already tried to achieve something
similar on windows with Auto Lossless Scaling for an easier Lossless Scaling integration. I think it can be done thanks
to the work of the Open Source community. My goal is to streamline the process and give Steam Big Picture the tools to
offer the best experience
to play games on regardless of your GPU.

## Installation

* [Download](https://github.com/Wurielle/decky-launch-options/releases) `decky-launch-options.zip` file and import it
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

## Development

This project uses [ahoy](https://ahoyapi.dev/) as an IDE-agnostic task runner.

### Pre-requisites:

* [Docker Engine](https://docs.docker.com/engine/install/)
* [pnpm](https://pnpm.io/installation#using-npm)
* [ahoy](https://github.com/ahoy-cli/ahoy)

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

- `ahoy` - List all available commands

### Debugging

* [Chrome Inspect](chrome://inspect/#devices)
    * Discover network targets
        * <DECK_IP>:8081

---