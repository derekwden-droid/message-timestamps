# message-timestamps plugin privacy policy

Last updated: October 10, 2026

The message-timestamps plugin for Claude Code collects no data. It has no servers, no accounts, no
analytics and no telemetry, and it never connects to the network.

## What the plugin accesses

The plugin is a mod: it runs inside Claude Code on your computer. It sees the message rows Claude
Code draws and the moment each prompt is stored, and it reads the current session's transcript,
which Claude Code keeps on your computer, once, to find the times of earlier messages. It reads no
other files.

## What happens to that data

The plugin keeps message times (an id and a time for each message, never the message's text) and
your `/timestamps` choice in its own storage inside Claude Code on your computer, for the 60 most
recent sessions. It draws the times in Claude Code's interface. Nothing leaves your computer.

## Retention

Times are kept for the 60 most recent sessions; older ones are dropped.

## Changes and contact

Changes to this policy are made in this file and recorded in the repository's history. Questions
go to [github.com/derekwden-droid/message-timestamps/issues](https://github.com/derekwden-droid/message-timestamps/issues).
