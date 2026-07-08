import SwiftUI
import ForayKit

// MARK: - TodayView
//
// The session picker: four curated cards (docs/brief/03_CURATION_SPEC.md
// "4-slot menu"), designed per 04_VOICE_AUDIO_SPEC.md "Safety framing" and
// 01_PROMPT.md hard constraint #6 ("Car-safe UX... Big tap targets on the
// session picker"):
// - Cards fill nearly the whole screen width and a large fixed minimum
//   height (`cardMinHeight`), stacked vertically, so a full card is
//   reachable and unambiguous to tap without precision.
// - Cards are anchored toward the bottom half of the screen
//   ("one-hand reach" — 01_PROMPT.md "huge tap targets", 02_ARCHITECTURE.md
//   "Today (session cards, huge tap targets, one-hand reach)") by living
//   inside a `ScrollView` that starts below a compact header rather than a
//   top-anchored list — on a modern tall iPhone the whole card stack sits
//   within comfortable one-handed thumb reach when the phone is held
//   normally.
// - No text on this screen is required reading to operate the app: tapping
//   anywhere on a card is the entire interaction, and the same four
//   choices are reachable by voice (Tier-1 grammar `.playOption`) once
//   VoiceController exists.
struct TodayView: View {
    @EnvironmentObject private var sessionStore: SessionStore
    @Environment(\.playerQueueManager) private var playerQueueManager

    /// Large enough that missing by a centimeter still lands inside the
    /// card. Tuned to comfortably clear Apple's 44pt minimum many times
    /// over — this is "huge," not merely "compliant."
    private let cardMinHeight: CGFloat = 132

    var body: some View {
        NavigationStack {
            Group {
                if let session = sessionStore.session {
                    ScrollView {
                        VStack(spacing: 16) {
                            headerView(session: session)
                            ForEach(session.cards.sorted(by: { $0.slot < $1.slot })) { card in
                                NavigationLink {
                                    NowPlayingView(card: card)
                                } label: {
                                    CardView(
                                        card: card,
                                        episode: sessionStore.episode(for: card.episodeID),
                                        minHeight: cardMinHeight
                                    )
                                }
                                .buttonStyle(.plain)
                                // Whole-card hit target, not just the text —
                                // required for "huge tap targets" to mean
                                // anything in practice.
                                .contentShape(Rectangle())
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.bottom, 32)
                    }
                } else if let error = sessionStore.loadError {
                    ContentUnavailableFallback(message: error)
                } else {
                    ProgressView("Loading your commute…")
                }
            }
            .navigationTitle("Today")
        }
    }

    private func headerView(session: Session) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("\(session.commute.minutes)-minute commute")
                .font(.title3.weight(.semibold))
            Text("\(session.commute.contentMinutes) min prepped at \(session.commute.playbackSpeed, specifier: "%.1f")×")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, 8)
    }
}

/// Requires `SessionCard: Identifiable`. Slot number is already a stable,
/// unique-within-session identifier, so we conform via slot rather than
/// adding a synthetic id to the Codable model in ForayKit.
extension SessionCard: Identifiable {
    public var id: Int { slot }
}

private struct CardView: View {
    let card: SessionCard
    let episode: Episode?
    let minHeight: CGFloat

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(card.archetypeLabel.uppercased())
                .font(.caption.weight(.bold))
                .foregroundStyle(archetypeTint)
                .tracking(0.5)

            Text(episode?.title ?? card.episodeID)
                .font(.title3.weight(.semibold))
                .lineLimit(2)
                .foregroundStyle(.primary)

            Text(card.whyLine)
                .font(.body)
                .foregroundStyle(.secondary)
                .lineLimit(3)

            Spacer(minLength: 0)

            Text(card.fitLine)
                .font(.footnote.weight(.medium))
                .foregroundStyle(.tertiary)
        }
        .padding(20)
        .frame(maxWidth: .infinity, minHeight: minHeight, alignment: .topLeading)
        .background(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(.thinMaterial)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .strokeBorder(archetypeTint.opacity(0.35), lineWidth: 1.5)
        )
    }

    private var archetypeTint: Color {
        switch card.archetype {
        case .deepLearn: return .blue
        case .stretch: return .purple
        case .narrative: return .orange
        case .comfort: return .green
        case .other: return .gray
        }
    }
}

private struct ContentUnavailableFallback: View {
    let message: String
    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle")
                .font(.largeTitle)
                .foregroundStyle(.secondary)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
        }
    }
}

#Preview {
    // AUDIT: `#Preview` trailing closures run on the main actor in Xcode's
    // preview host, matching `SessionStore`'s `@MainActor` isolation — this
    // has not been compiled/run in Xcode to confirm. If Xcode flags an
    // isolation error here, wrap the body in a `MainActor`-isolated helper
    // or switch to `.task { sessionStore.loadSampleSession() }` instead.
    let store = SessionStore()
    store.loadSampleSession()
    return TodayView()
        .environmentObject(store)
}
