#!/usr/bin/env swift
/**
 * Play a sound file at a specified volume or at the system alert volume.
 *
 * Usage: play-alert-sound <path-to-sound-file> [volume-percentage]
 *
 *   volume-percentage: 0-100 (optional, defaults to system alert volume)
 *
 * Examples:
 *   play-alert-sound /System/Library/Sounds/Tink.aiff
 *   play-alert-sound /System/Library/Sounds/Tink.aiff 75
 */

import Foundation
import AVFoundation

// MARK: - Alert Volume Reader

func getAlertVolume() -> Float {
    // Read system alert volume using defaults command (global domain)
    let task = Process()
    task.executableURL = URL(fileURLWithPath: "/usr/bin/defaults")
    task.arguments = ["read", "-g", "com.apple.sound.beep.volume"]

    let pipe = Pipe()
    task.standardOutput = pipe

    do {
        try task.run()
        task.waitUntilExit()

        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        if let output = String(data: data, encoding: .utf8) {
            let trimmed = output.trimmingCharacters(in: .whitespacesAndNewlines)
            if let volume = Float(trimmed) {
                return volume
            }
        }
    } catch {
        // Fall through to default
    }

    return 0.75 // Default macOS alert volume
}

// MARK: - Sound Playback

func playSound(at path: String, volume: Float) -> Bool {
    let url = URL(fileURLWithPath: path)

    guard FileManager.default.fileExists(atPath: path) else {
        print("Error: Sound file not found: \(path)", to: &stderr)
        return false
    }

    do {
        let player = try AVAudioPlayer(contentsOf: url)
        player.volume = volume
        player.prepareToPlay()
        player.play()

        // Wait for playback to finish
        while player.isPlaying {
            RunLoop.current.run(mode: .default, before: Date(timeIntervalSinceNow: 0.1))
        }

        return true
    } catch {
        print("Error: Failed to play sound: \(error)", to: &stderr)
        return false
    }
}

// MARK: - Main

var stderr = FileHandle.standardError

extension FileHandle: @retroactive TextOutputStream {
    public func write(_ string: String) {
        guard let data = string.data(using: .utf8) else { return }
        self.write(data)
    }
}

// Parse arguments
let args = CommandLine.arguments

guard args.count > 1 else {
    print("Usage: \(args[0]) <path-to-sound-file> [volume-percentage]", to: &stderr)
    print("  volume-percentage: 0-100 (optional, defaults to system alert volume)", to: &stderr)
    exit(1)
}

let soundPath = args[1]

// Maximum volume cap (75% = 0.75) to prevent overly loud notifications
let maxVolume: Float = 0.75

// Determine volume: use provided percentage or read system alert volume
let volume: Float
var clamped = false

if args.count > 2 {
    if let percentage = Float(args[2]) {
        // Clamp to 0-100 range and convert to 0.0-1.0
        var normalized = max(0, min(100, percentage)) / 100.0
        // Clamp to max volume
        if normalized > maxVolume {
            normalized = maxVolume
            clamped = true
        }
        volume = normalized
    } else {
        print("Error: Invalid volume percentage: \(args[2])", to: &stderr)
        exit(1)
    }
} else {
    volume = getAlertVolume()
    // Also clamp system alert volume if it's above max
    if volume > maxVolume {
        clamped = true
    }
}

let finalVolume = min(volume, maxVolume)

if clamped {
    print("Warning: Volume clamped to \(Int(maxVolume * 100))%", to: &stderr)
}

let success = playSound(at: soundPath, volume: finalVolume)
exit(success ? 0 : 1)
