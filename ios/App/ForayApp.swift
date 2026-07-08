import SwiftUI

// MARK: - Environment plumbing for PlayerQueueManager
//
// `PlayerQueueManager` is an `actor`, not an `ObservableObject` (its
// mutable state is playback-internal, not something views bind to
// directly — views observe via `NowPlayingViewModel`/polling in a fuller
// implementation; this scaffold keeps it simple, see NowPlayingView.swift).
// It's threaded through the view hierarchy via a plain `EnvironmentKey`
// rather than `@EnvironmentObject`, since that requires `ObservableObject`.
private struct PlayerQueueManagerKey: EnvironmentKey {
    static let defaultValue: PlayerQueueManager? = nil
}

extension EnvironmentValues {
    var playerQueueManager: PlayerQueueManager? {
        get { self[PlayerQueueManagerKey.self] }
        set { self[PlayerQueueManagerKey.self] = newValue }
    }
}

@main
struct ForayApp: App {
    @StateObject private var sessionStore = SessionStore()

    // Single instance for the app's lifetime — this IS the single-player
    // invariant (05_CORNER_CASES.md #19) at the object-graph level: there
    // is exactly one `PlayerQueueManager`, therefore exactly one
    // `AVPlayer`, for the whole process.
    private let playerQueueManager = PlayerQueueManager()

    var body: some Scene {
        WindowGroup {
            TodayView()
                .environmentObject(sessionStore)
                .environment(\.playerQueueManager, playerQueueManager)
                .task {
                    // AUDIT: `sessionStore.loadSampleSession()` reads from
                    // the app bundle synchronously; harmless on the main
                    // actor. `configureRemoteCommands()` registers
                    // MPRemoteCommandCenter targets — per
                    // 05_CORNER_CASES.md #23 ("Siri intent while app
                    // cold") this arguably needs to happen even earlier /
                    // independent of the first view appearing, e.g. from
                    // an App Intent's own perform() on a cold launch. Not
                    // implemented in this scaffold (no App Intents yet —
                    // see README); flagging so it isn't forgotten once
                    // VoiceController/App Intents land in M4.
                    sessionStore.loadSampleSession()
                    await playerQueueManager.configureRemoteCommands()
                }
        }
    }
}
