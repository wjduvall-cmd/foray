import Foundation

// MARK: - IntentGrammar
//
// Tier-1 local intent grammar (docs/brief/04_VOICE_AUDIO_SPEC.md, "Tier 1 —
// local grammar (regex/keyword, offline, <300 ms)"). Deterministic,
// dependency-free (no NSRegularExpression, no AVFoundation) so it runs
// entirely offline and is trivially unit-testable.
//
// Ground rules encoded here per docs/brief/05_CORNER_CASES.md:
// - #20 "Recognition in road noise": key on robust short words; low
//   confidence + no grammar hit -> fail fast (`.unrecognized`), never guess.
// - #22 "Homophones & show-name collisions": ordinals ALWAYS beat fuzzy
//   title matches. When fuzzy match confidence is merely middling, return
//   `.needsConfirmation` with a spoken confirm line, never silently commit.
//
// This grammar is intentionally conservative: `.recognized` is reserved for
// inputs the grammar is confident about. Anything ambiguous surfaces as
// `.needsConfirmation`, and anything with no keyword hit at all surfaces as
// `.unrecognized` — the caller (VoiceController) is expected to earcon-fail
// fast on `.unrecognized`, per spec, rather than passing it to Tier 2 on a
// low-confidence Tier-1 guess. (Tier-2 free-text fallback IS appropriate for
// `.unrecognized` — that routing decision lives outside this file.)

public enum IntentKind: Equatable, Sendable {
    /// Skip the current item entirely (spec aliases "skip" and "next" onto
    /// the same forward-navigation action; see design note below).
    case skip
    case previous
    case pause
    case resume
    /// Play a specific card by resolved 1-based slot number.
    case playOption(Int)
    case moreLikeThis
    case somethingDifferent
    case save
    case whatIsThis
    case thumbsUp
    case thumbsDown
    case faster
    case slower
    case familyModeOn
    case familyModeOff
    /// "skip intro" / "just play" — disambiguated from `.skip` because
    /// during an intro the target of "skip" is context-dependent
    /// (05_CORNER_CASES.md #21: "skip" during an intro skips the *episode*
    /// being introduced; only an explicit "skip intro"/"just play" skips
    /// just the TTS). The caller resolves which applies based on current
    /// playback context; this grammar only distinguishes the two phrasings.
    case skipIntroOnly
}

public struct ParsedIntent: Equatable, Sendable {
    public enum Outcome: Equatable, Sendable {
        case recognized(IntentKind)
        case needsConfirmation(candidate: IntentKind, prompt: String)
        case unrecognized
    }

    public let outcome: Outcome
    public let confidence: Double
    public let rawTranscript: String

    public init(outcome: Outcome, confidence: Double, rawTranscript: String) {
        self.outcome = outcome
        self.confidence = confidence
        self.rawTranscript = rawTranscript
    }

    public static func recognized(_ kind: IntentKind, confidence: Double, rawTranscript: String) -> ParsedIntent {
        ParsedIntent(outcome: .recognized(kind), confidence: confidence, rawTranscript: rawTranscript)
    }

    public static func needsConfirmation(_ kind: IntentKind, confidence: Double, prompt: String, rawTranscript: String) -> ParsedIntent {
        ParsedIntent(outcome: .needsConfirmation(candidate: kind, prompt: prompt), confidence: confidence, rawTranscript: rawTranscript)
    }

    public static func unrecognized(rawTranscript: String) -> ParsedIntent {
        ParsedIntent(outcome: .unrecognized, confidence: 0, rawTranscript: rawTranscript)
    }
}

/// A slot's known keywords for fuzzy "play the fusion one" style matching,
/// e.g. built from a card's title/show/topic words at session-build time.
/// Keyed by 1-based slot number to match `IntentKind.playOption`.
public typealias CardKeywords = [Int: [String]]

public enum IntentGrammar {

    // MARK: Tunables

    /// Below this, we don't even offer a confirmation — the utterance
    /// didn't hit any grammar rule closely enough to be worth surfacing.
    /// Kept comfortably below the single-keyword-tie confidence value
    /// (~0.35) with margin for floating-point rounding, so a genuine tie
    /// between two cards reliably surfaces as `.needsConfirmation` rather
    /// than silently falling through to `.unrecognized`.
    private static let confirmationFloor = 0.3
    /// At or above this, a fuzzy card-title match is confident enough to
    /// act on directly without a spoken confirmation.
    private static let fuzzyAutoAcceptFloor = 0.75

    /// Filler words stripped before matching. Deliberately short list of
    /// genuinely contentless words. Crucially this must NOT include any
    /// word that is itself part of a recognized phrase — "just" ("just
    /// play") and "like" ("more **like** this", "i **like** this") are
    /// semantically load-bearing here even though they're filler in other
    /// contexts, so they are NOT stripped.
    private static let fillerWords: Set<String> = [
        "uh", "um", "erm", "hmm", "please", "kinda", "sorta", "so", "okay", "ok"
    ]

    /// Explicit ordinal-word / digit tokens for option selection. Deliberately
    /// excludes bare cardinal words ("one", "two", "three", "four") — those
    /// are ambiguous with their use as a placeholder noun ("play the fusion
    /// **one**"), which is exactly the homophone/collision trap in
    /// 05_CORNER_CASES.md #22. Only unambiguous ordinal words and bare
    /// digits count as an explicit option reference.
    private static let ordinalWords: [String: Int] = [
        "first": 1, "second": 2, "third": 3, "fourth": 4,
        "1st": 1, "2nd": 2, "3rd": 3, "4th": 4
    ]
    private static let digitWords: [String: Int] = ["1": 1, "2": 2, "3": 3, "4": 4]
    /// When one of these precedes a bare cardinal number word, the number
    /// word DOES count as an explicit option reference ("play option one",
    /// "number two", "card three", "slot four").
    private static let optionCueWords: Set<String> = ["option", "number", "card", "slot"]
    private static let cardinalWords: [String: Int] = ["one": 1, "two": 2, "three": 3, "four": 4]

    /// Words that carry no selection-identifying content on their own,
    /// stripped before both (a) deciding whether a bare "play" really means
    /// "resume playback" vs. "play a specific card", and (b) fuzzy
    /// card-title matching.
    private static let contentStopwords: Set<String> = [
        "play", "the", "a", "an", "one", "is", "this", "that", "of", "episode", "it", "to", "me"
    ]

    // MARK: Entry point

    /// Parses a single voice transcript into a structured intent.
    /// - Parameters:
    ///   - transcript: raw text from SFSpeechRecognizer (or typed free
    ///     text in a debug harness).
    ///   - cardKeywords: current session's per-slot keyword lists, used for
    ///     fuzzy title matching ("play the fusion one"). Pass an empty
    ///     dictionary when no session is loaded (e.g. before first session
    ///     build) — fuzzy option matching simply won't fire.
    public static func parse(_ transcript: String, cardKeywords: CardKeywords = [:]) -> ParsedIntent {
        let tokens = normalize(transcript)
        guard !tokens.isEmpty else {
            return .unrecognized(rawTranscript: transcript)
        }
        let tokenSet = Set(tokens)

        // 1. Explicit ordinal / option-number reference always wins over
        //    fuzzy matching (05_CORNER_CASES.md #22: "Ordinals win").
        if let slot = explicitOrdinal(in: tokens) {
            return .recognized(.playOption(slot), confidence: 1.0, rawTranscript: transcript)
        }

        // 2. Deterministic short-word keyword grammar (skip, pause,
        //    "resume"/"continue", more-like-this, etc). Note this
        //    deliberately does NOT treat bare "play" as unambiguous resume
        //    — see step 4 — because "play" is also the verb in "play the
        //    fusion one", a card-selection command, not a resume command.
        if let deterministic = matchDeterministicPhrases(tokens: tokens, tokenSet: tokenSet) {
            return .recognized(deterministic, confidence: 1.0, rawTranscript: transcript)
        }

        // 3. Fuzzy card-title/keyword match ("play the fusion one", "the
        //    segment one"). Checked BEFORE the bare-"play" resume fallback
        //    so a title reference always takes priority over defaulting to
        //    "resume playback".
        if !cardKeywords.isEmpty, let fuzzy = fuzzyCardMatch(tokenSet: tokenSet, cardKeywords: cardKeywords) {
            if fuzzy.confidence >= fuzzyAutoAcceptFloor {
                return .recognized(.playOption(fuzzy.slot), confidence: fuzzy.confidence, rawTranscript: transcript)
            }
            if fuzzy.confidence >= confirmationFloor {
                return .needsConfirmation(
                    .playOption(fuzzy.slot),
                    confidence: fuzzy.confidence,
                    prompt: fuzzy.confirmationPrompt,
                    rawTranscript: transcript
                )
            }
        }

        // 4. Bare "play" with no other identifying content word left
        //    (after stripping stopwords) means "resume playback" — e.g.
        //    "play", "play it", "play please". If content words remain
        //    that didn't resolve via ordinal or fuzzy match above, this is
        //    an attempted card selection that failed to match anything;
        //    never fall back to guessing "resume" in that case.
        if tokenSet.contains("play") {
            let remainingContent = tokenSet.subtracting(contentStopwords)
            if remainingContent.isEmpty {
                return .recognized(.resume, confidence: 1.0, rawTranscript: transcript)
            }
        }

        // 5. Nothing matched confidently. Never guess.
        return .unrecognized(rawTranscript: transcript)
    }

    // MARK: Normalization

    /// Apostrophe variants that are deleted in place (not treated as word
    /// separators) so contractions collapse the way a human would write
    /// them without the apostrophe: "don't" -> "dont", "what's" -> "whats".
    /// This matters because the phrase table below is written in that
    /// collapsed form.
    private static let apostrophes: Set<Unicode.Scalar> = ["'", "\u{2019}"]

    /// Lowercases, strips punctuation, splits on whitespace, and drops
    /// filler words. Word order is preserved (needed for multi-word phrase
    /// matching like "family mode on").
    static func normalize(_ transcript: String) -> [String] {
        let lowered = transcript.lowercased()
        var currentWord = ""
        var words: [String] = []
        for scalar in lowered.unicodeScalars {
            if CharacterSet.alphanumerics.contains(scalar) {
                currentWord.unicodeScalars.append(scalar)
            } else if apostrophes.contains(scalar) {
                // Delete in place: "don't" -> "dont", not "don" + "t".
                continue
            } else {
                if !currentWord.isEmpty {
                    words.append(currentWord)
                    currentWord = ""
                }
            }
        }
        if !currentWord.isEmpty {
            words.append(currentWord)
        }
        return words.filter { !fillerWords.contains($0) }
    }

    // MARK: Ordinal / option-number detection

    private static func explicitOrdinal(in tokens: [String]) -> Int? {
        for (index, token) in tokens.enumerated() {
            if let slot = ordinalWords[token] {
                return slot
            }
            if let slot = digitWords[token] {
                return slot
            }
            if let slot = cardinalWords[token], index > 0, optionCueWords.contains(tokens[index - 1]) {
                // "option one", "number two", "card three", "slot four"
                return slot
            }
        }
        return nil
    }

    // MARK: Deterministic keyword phrases

    /// Returns the first matching intent for a fixed set of robust
    /// short-word phrases. Multi-word phrases are checked as contiguous
    /// substrings of the token stream; single-word triggers are checked
    /// against the token set.
    private static func matchDeterministicPhrases(tokens: [String], tokenSet: Set<String>) -> IntentKind? {
        let joined = " " + tokens.joined(separator: " ") + " "

        func contains(_ phrase: String) -> Bool {
            joined.contains(" " + phrase + " ")
        }

        // "skip intro" / "just play" must be checked before bare "skip",
        // since both phrasings also contain no separate "skip" token in
        // the "just play" case, but ordering still matters conceptually —
        // keep this check first for clarity and future-proofing if a
        // phrasing like "skip the intro" is added later.
        if contains("skip intro") || contains("just play") || contains("skip the intro") {
            return .skipIntroOnly
        }

        if contains("family mode on") || contains("kid mode on") || contains("family mode") && tokenSet.contains("on") {
            return .familyModeOn
        }
        if contains("family mode off") || contains("kid mode off") || contains("family mode") && tokenSet.contains("off") {
            return .familyModeOff
        }

        if contains("something different") || contains("something else") || contains("change it up") || contains("not this") {
            return .somethingDifferent
        }
        if contains("more like this") || contains("more of this") || contains("play something similar") {
            return .moreLikeThis
        }
        if contains("what is this") || contains("whats this") || contains("what am i listening to") {
            return .whatIsThis
        }
        if contains("save this") || contains("save it") || contains("save for later") {
            return .save
        }
        if contains("thumbs up") || contains("i like this") || contains("love this") {
            return .thumbsUp
        }
        if contains("thumbs down") || contains("i dont like this") || contains("hate this") {
            return .thumbsDown
        }
        if contains("speed up") || tokenSet.contains("faster") {
            return .faster
        }
        if contains("slow down") || tokenSet.contains("slower") {
            return .slower
        }

        // Robust short single words last, since they're the most likely to
        // be caught in noisy/degraded audio (05_CORNER_CASES.md #20).
        if tokenSet.contains("skip") || tokenSet.contains("next") {
            return .skip
        }
        if tokenSet.contains("back") || tokenSet.contains("previous") {
            return .previous
        }
        if tokenSet.contains("pause") || tokenSet.contains("stop") {
            // "stop" isn't in the spec's literal Tier-1 word list but is a
            // near-universal way to ask for playback to pause; mapping it
            // to `.pause` (not a hard queue-stop) matches user intent in
            // the overwhelming majority of utterances of this word.
            return .pause
        }
        if tokenSet.contains("resume") || tokenSet.contains("continue") {
            // Deliberately excludes bare "play": see step 4 in `parse`.
            return .resume
        }

        return nil
    }

    // MARK: Fuzzy card-title matching

    private struct FuzzyMatch {
        let slot: Int
        let confidence: Double
        let confirmationPrompt: String
    }

    /// Scores each slot's keyword list against the transcript's tokens.
    /// Confidence is proportional to how many of a slot's keywords appear
    /// in the transcript. Ties (more than one slot with the same top
    /// score) are treated as ambiguous and reported at reduced confidence
    /// so the caller routes to `.needsConfirmation` rather than guessing.
    private static func fuzzyCardMatch(tokenSet: Set<String>, cardKeywords: CardKeywords) -> FuzzyMatch? {
        let contentTokens = tokenSet.subtracting(contentStopwords)
        guard !contentTokens.isEmpty else { return nil }

        var scored: [(slot: Int, overlap: Int, keywordCount: Int)] = []
        for (slot, keywords) in cardKeywords {
            let normalizedKeywords = Set(keywords.map { $0.lowercased() })
            guard !normalizedKeywords.isEmpty else { continue }
            let overlap = contentTokens.intersection(normalizedKeywords).count
            if overlap > 0 {
                scored.append((slot: slot, overlap: overlap, keywordCount: normalizedKeywords.count))
            }
        }
        guard !scored.isEmpty else { return nil }

        // Sort by overlap descending, then by slot ascending so tie-breaks
        // are deterministic regardless of Swift Dictionary's unspecified
        // (and per-process-randomized) iteration order for `cardKeywords`.
        scored.sort { lhs, rhs in
            lhs.overlap != rhs.overlap ? lhs.overlap > rhs.overlap : lhs.slot < rhs.slot
        }
        let top = scored[0]
        let runnerUpOverlap = scored.count > 1 ? scored[1].overlap : 0

        // Base confidence from overlap ratio, penalized if a runner-up
        // scored the same (genuine ambiguity between two cards).
        var confidence = 0.55 + 0.15 * Double(min(top.overlap, 3))
        if runnerUpOverlap == top.overlap {
            confidence *= 0.5
        }
        confidence = min(confidence, 0.95)

        let prompt = "The option \(top.slot) episode?"
        return FuzzyMatch(slot: top.slot, confidence: confidence, confirmationPrompt: prompt)
    }
}
