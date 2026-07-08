import Foundation
import ForayKit

// MARK: - SessionStore
//
// Loads and holds the current session document. In this scaffold, "loads"
// means decoding the bundled sample fixture (a copy of data/session.json)
// via `Bundle.main` — there is no backend yet (`GET /sessions/current` per
// docs/brief/02_ARCHITECTURE.md API surface is not implemented). Swapping
// this for a real network+local-cache-backed implementation should not
// require any changes to `Session`/`SessionCard`/`Episode` (ForayKit)
// or to TodayView/NowPlayingView, which only depend on those model types.
@MainActor
public final class SessionStore: ObservableObject {
    @Published public private(set) var session: Session?
    @Published public private(set) var loadError: String?

    public init() {}

    /// Loads `sample_session.json` from the app bundle. Call from
    /// `ForayApp.init` or a `.task` modifier on the root view.
    public func loadSampleSession() {
        guard let url = Bundle.main.url(forResource: "sample_session", withExtension: "json") else {
            loadError = "sample_session.json not found in app bundle — check project.yml resources."
            return
        }
        do {
            let data = try Data(contentsOf: url)
            session = try Session.decode(from: data)
            loadError = nil
        } catch {
            // AUDIT: none — this is a well-understood local-file decode
            // path with no AVFoundation/OS API uncertainty. A real decode
            // failure here (schema drift between the bundled fixture and
            // SessionModels.swift) is a genuine bug to fix, not a runtime
            // condition to design around.
            session = nil
            loadError = "Failed to decode sample_session.json: \(error)"
        }
    }

    /// Looks up an episode by id in the currently-loaded session. Every
    /// view that needs episode details (title, duration, summary) for a
    /// card goes through this rather than re-decoding or duplicating data.
    public func episode(for id: String) -> Episode? {
        session?.episodes[id]
    }
}
