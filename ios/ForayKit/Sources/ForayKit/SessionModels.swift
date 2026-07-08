import Foundation

// MARK: - Session document (v1)
//
// Codable models mirroring the "Session" document produced by the backend's
// curation engine (docs/brief/02_ARCHITECTURE.md, "Curation engine + session
// builder") and exactly matching the shape of `data/session.json`.
//
// Design notes:
// - Every type declares explicit `CodingKeys` with the snake_case wire
//   names. We deliberately do NOT rely on `JSONDecoder.keyDecodingStrategy
//   = .convertFromSnakeCase` anywhere in the app: mixing an explicit
//   CodingKeys enum (whose raw values are already snake_case) with that
//   decoder strategy is a classic footgun (the strategy transforms the key
//   *before* it's matched against CodingKeys, so "session_id" becomes
//   "sessionId" and then fails to match a CodingKeys case whose rawValue is
//   still "session_id"). Explicit CodingKeys + a plain `JSONDecoder()` is
//   correct regardless of caller configuration.
// - `version` is decoded but callers should switch on it before assuming
//   this v1 shape holds (docs/brief/01_PROMPT.md ADR item 9: "Migration/
//   versioning for session format"). A `SessionDecodeError.unsupportedVersion`
//   is thrown by `Session.decode(from:)` for anything other than 1, so a
//   future v2 document fails loudly instead of silently losing fields.
// - Several open-ended string enums (`Archetype`, `EpisodeDepth`,
//   `EpisodeFormat`) decode any unrecognized raw value into an `.other`
//   case rather than throwing. The session format is expected to evolve
//   (new archetypes, new format tags); a forward-compatible client should
//   degrade gracefully (e.g. render the raw label) rather than fail to
//   decode the whole session because of one new tag.

/// Top-level error for session decoding, distinct from `DecodingError` so
/// callers can special-case "this is a future/older version I don't
/// understand" from "this JSON is simply malformed."
public enum SessionDecodeError: Error, Equatable, Sendable {
    case unsupportedVersion(Int)
}

public struct Session: Codable, Equatable, Sendable {
    public let version: Int
    public let sessionID: String
    /// Raw ISO-8601 string exactly as it appears on the wire. Kept as a
    /// String (not eagerly parsed to `Date`) so a malformed/unexpected
    /// timestamp format never fails decoding of the whole session — callers
    /// that need a `Date` use `builtAt`, which returns `nil` on parse
    /// failure instead of throwing.
    public let builtAtRaw: String
    public let commute: Commute
    public let cards: [SessionCard]
    public let categories: [SessionCategory]
    /// Keyed by episode_id. A dictionary in the wire format, so this is a
    /// dictionary here too (not an array) to avoid a lossy re-encode.
    public let episodes: [String: Episode]

    enum CodingKeys: String, CodingKey {
        case version
        case sessionID = "session_id"
        case builtAtRaw = "built_at"
        case commute
        case cards
        case categories
        case episodes
    }

    // NOTE: Swift's auto-generated memberwise initializer for a `public`
    // struct is only `internal`, even when every stored property is
    // `public` — it would NOT be usable from the App target (a different
    // module) despite Codable's synthesized init(from:)/encode(to:) being
    // fully public via the `Codable` conformance synthesis. Every public
    // model in this file therefore gets an explicit `public init` so App
    // code (tests, previews, fixtures) can construct these directly, not
    // just decode them.
    public init(
        version: Int,
        sessionID: String,
        builtAtRaw: String,
        commute: Commute,
        cards: [SessionCard],
        categories: [SessionCategory],
        episodes: [String: Episode]
    ) {
        self.version = version
        self.sessionID = sessionID
        self.builtAtRaw = builtAtRaw
        self.commute = commute
        self.cards = cards
        self.categories = categories
        self.episodes = episodes
    }

    /// Parses a session document, first checking `version` before decoding
    /// the rest. This is the entry point apps should use; a raw
    /// `JSONDecoder().decode(Session.self, from:)` still works (useful in
    /// tests that specifically want to assert v1 field values) but skips
    /// the version gate.
    public static func decode(from data: Data) throws -> Session {
        // Peek at the version field only, cheaply, before committing to a
        // full decode against this v1 model.
        struct VersionProbe: Decodable { let version: Int }
        let probe = try JSONDecoder().decode(VersionProbe.self, from: data)
        guard probe.version == 1 else {
            throw SessionDecodeError.unsupportedVersion(probe.version)
        }
        return try JSONDecoder().decode(Session.self, from: data)
    }

    /// Best-effort parse of `builtAtRaw`. Tries the common ISO-8601 forms
    /// seen in the session document ("2026-07-08T04:30:00-07:00" — offset,
    /// no fractional seconds) and falls back to fractional-seconds form in
    /// case the backend starts emitting those. Returns nil rather than
    /// throwing if neither matches, since this is a convenience accessor
    /// and stale-session logic should not crash on a date that fails to
    /// parse.
    public var builtAt: Date? {
        let formatter = ISO8601DateFormatter()
        if let date = formatter.date(from: builtAtRaw) {
            return date
        }
        formatter.formatOptions.insert(.withFractionalSeconds)
        return formatter.date(from: builtAtRaw)
    }
}

public struct Commute: Codable, Equatable, Sendable {
    public let minutes: Int
    public let playbackSpeed: Double
    public let contentMinutes: Int

    enum CodingKeys: String, CodingKey {
        case minutes
        case playbackSpeed = "playback_speed"
        case contentMinutes = "content_minutes"
    }

    public init(minutes: Int, playbackSpeed: Double, contentMinutes: Int) {
        self.minutes = minutes
        self.playbackSpeed = playbackSpeed
        self.contentMinutes = contentMinutes
    }
}

/// The four (or however many, in future versions) fixed-archetype slots of
/// the session menu. See docs/brief/03_CURATION_SPEC.md, "The 4-slot menu:
/// variety by construction."
public struct SessionCard: Codable, Equatable, Sendable {
    public let slot: Int
    public let archetype: Archetype
    public let archetypeLabel: String
    public let episodeID: String
    /// The one-line "why" — spoken as the opening of the TTS intro and
    /// shown on the card. ≤ 18 words per the curation spec.
    public let whyLine: String
    /// Duration / fit framing ("37 min ≈ 25 at your speed").
    public let fitLine: String
    /// Alternate episode_ids the curation engine considered for this slot
    /// (used for e.g. "not feeling that one" without a full rebuild).
    public let alternates: [String]

    enum CodingKeys: String, CodingKey {
        case slot
        case archetype
        case archetypeLabel = "archetype_label"
        case episodeID = "episode_id"
        case whyLine = "why_line"
        case fitLine = "fit_line"
        case alternates
    }

    public init(
        slot: Int,
        archetype: Archetype,
        archetypeLabel: String,
        episodeID: String,
        whyLine: String,
        fitLine: String,
        alternates: [String]
    ) {
        self.slot = slot
        self.archetype = archetype
        self.archetypeLabel = archetypeLabel
        self.episodeID = episodeID
        self.whyLine = whyLine
        self.fitLine = fitLine
        self.alternates = alternates
    }
}

/// The four archetype slots from the curation spec. `.other` absorbs any
/// value the current app build doesn't know about yet, so a newly
/// introduced archetype degrades to "show the raw label" instead of
/// breaking decode.
public enum Archetype: Equatable, Hashable, Sendable {
    case deepLearn
    case stretch
    case narrative
    case comfort
    case other(String)

    public init(rawValue: String) {
        switch rawValue {
        case "deep-learn": self = .deepLearn
        case "stretch": self = .stretch
        case "narrative": self = .narrative
        case "comfort": self = .comfort
        default: self = .other(rawValue)
        }
    }

    public var rawValue: String {
        switch self {
        case .deepLearn: return "deep-learn"
        case .stretch: return "stretch"
        case .narrative: return "narrative"
        case .comfort: return "comfort"
        case .other(let value): return value
        }
    }
}

extension Archetype: Codable {
    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        self.init(rawValue: try container.decode(String.self))
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(rawValue)
    }
}

public struct SessionCategory: Codable, Equatable, Sendable {
    public let id: String
    public let label: String
    public let description: String
    public let groups: [SessionCategoryGroup]

    enum CodingKeys: String, CodingKey {
        case id, label, description, groups
    }

    public init(id: String, label: String, description: String, groups: [SessionCategoryGroup]) {
        self.id = id
        self.label = label
        self.description = description
        self.groups = groups
    }
}

public struct SessionCategoryGroup: Codable, Equatable, Sendable {
    public let label: String
    public let episodeIDs: [String]

    enum CodingKeys: String, CodingKey {
        case label
        case episodeIDs = "episode_ids"
    }

    public init(label: String, episodeIDs: [String]) {
        self.label = label
        self.episodeIDs = episodeIDs
    }
}

public struct Episode: Codable, Equatable, Sendable {
    public let show: String
    public let title: String
    /// Kept as a raw "YYYY-MM-DD" string; date-only fields don't carry a
    /// timezone, so parsing to `Date` here would silently assume one.
    /// Callers that need day-level comparisons should parse with an
    /// explicit UTC calendar, deliberately opting into that assumption.
    public let releaseDate: String
    public let durationMin: Int
    public let appleCollectionID: Int?
    public let appleTrackID: Int?
    public let summary: String
    public let depth: EpisodeDepth
    public let format: EpisodeFormat
    public let topics: [String]
    /// Only present on some episodes (e.g. the fusion-tour category);
    /// absent entirely for most. Optional, defaults to empty on decode.
    public let reactorTypes: [String]

    enum CodingKeys: String, CodingKey {
        case show, title
        case releaseDate = "release_date"
        case durationMin = "duration_min"
        case appleCollectionID = "apple_collection_id"
        case appleTrackID = "apple_track_id"
        case summary, depth, format, topics
        case reactorTypes = "reactor_types"
    }

    /// Plain memberwise initializer. Not auto-generated because this
    /// struct already declares a custom `init(from:)` for
    /// `decodeIfPresent`-with-default handling of `topics`/`reactor_types`
    /// (see below) — once a struct has ANY custom initializer, Swift
    /// suppresses the automatic memberwise one entirely, so it's written
    /// out here for App-module callers that construct `Episode` directly
    /// (tests, previews, fixtures) rather than decoding it.
    public init(
        show: String,
        title: String,
        releaseDate: String,
        durationMin: Int,
        appleCollectionID: Int?,
        appleTrackID: Int?,
        summary: String,
        depth: EpisodeDepth,
        format: EpisodeFormat,
        topics: [String],
        reactorTypes: [String] = []
    ) {
        self.show = show
        self.title = title
        self.releaseDate = releaseDate
        self.durationMin = durationMin
        self.appleCollectionID = appleCollectionID
        self.appleTrackID = appleTrackID
        self.summary = summary
        self.depth = depth
        self.format = format
        self.topics = topics
        self.reactorTypes = reactorTypes
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        show = try container.decode(String.self, forKey: .show)
        title = try container.decode(String.self, forKey: .title)
        releaseDate = try container.decode(String.self, forKey: .releaseDate)
        durationMin = try container.decode(Int.self, forKey: .durationMin)
        appleCollectionID = try container.decodeIfPresent(Int.self, forKey: .appleCollectionID)
        appleTrackID = try container.decodeIfPresent(Int.self, forKey: .appleTrackID)
        summary = try container.decode(String.self, forKey: .summary)
        depth = try container.decode(EpisodeDepth.self, forKey: .depth)
        format = try container.decode(EpisodeFormat.self, forKey: .format)
        topics = try container.decodeIfPresent([String].self, forKey: .topics) ?? []
        reactorTypes = try container.decodeIfPresent([String].self, forKey: .reactorTypes) ?? []
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(show, forKey: .show)
        try container.encode(title, forKey: .title)
        try container.encode(releaseDate, forKey: .releaseDate)
        try container.encode(durationMin, forKey: .durationMin)
        try container.encodeIfPresent(appleCollectionID, forKey: .appleCollectionID)
        try container.encodeIfPresent(appleTrackID, forKey: .appleTrackID)
        try container.encode(summary, forKey: .summary)
        try container.encode(depth, forKey: .depth)
        try container.encode(format, forKey: .format)
        try container.encode(topics, forKey: .topics)
        if !reactorTypes.isEmpty {
            try container.encode(reactorTypes, forKey: .reactorTypes)
        }
    }
}

public enum EpisodeDepth: Equatable, Hashable, Sendable {
    case high
    case medium
    case low
    case other(String)

    public init(rawValue: String) {
        switch rawValue {
        case "high": self = .high
        case "medium": self = .medium
        case "low": self = .low
        default: self = .other(rawValue)
        }
    }

    public var rawValue: String {
        switch self {
        case .high: return "high"
        case .medium: return "medium"
        case .low: return "low"
        case .other(let value): return value
        }
    }
}

extension EpisodeDepth: Codable {
    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        self.init(rawValue: try container.decode(String.self))
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(rawValue)
    }
}

/// Format tag from Tier-1 enrichment (docs/brief/02_ARCHITECTURE.md). Used
/// to gate spoiler-free intro framing for narrative shows (04_VOICE_AUDIO_SPEC
/// "No spoilers" rule).
public enum EpisodeFormat: Equatable, Hashable, Sendable {
    case interview
    case documentary
    case solo
    case panel
    case narrative
    case hang
    case other(String)

    public init(rawValue: String) {
        switch rawValue {
        case "interview": self = .interview
        case "documentary": self = .documentary
        case "solo": self = .solo
        case "panel": self = .panel
        case "narrative": self = .narrative
        case "hang": self = .hang
        default: self = .other(rawValue)
        }
    }

    public var rawValue: String {
        switch self {
        case .interview: return "interview"
        case .documentary: return "documentary"
        case .solo: return "solo"
        case .panel: return "panel"
        case .narrative: return "narrative"
        case .hang: return "hang"
        case .other(let value): return value
        }
    }

    /// Narrative-format episodes must get topic-shaped intros, never
    /// content summaries (04_VOICE_AUDIO_SPEC "No spoilers").
    public var requiresSpoilerFreeIntro: Bool {
        self == .narrative || self == .documentary
    }
}

extension EpisodeFormat: Codable {
    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        self.init(rawValue: try container.decode(String.self))
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(rawValue)
    }
}
