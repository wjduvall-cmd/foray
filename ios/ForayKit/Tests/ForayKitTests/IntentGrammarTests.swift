import XCTest
@testable import ForayKit

final class IntentGrammarTests: XCTestCase {

    /// Keywords roughly modeled on data/session.json's four sample cards:
    /// slot 1 fusion deep-dive, slot 2 Damascus steel, slot 3 Assyrians
    /// (siege warfare), slot 4 Conan comedy hang.
    private let sampleCardKeywords: CardKeywords = [
        1: ["fusion", "reactor", "tokamak", "lex", "whyte"],
        2: ["damascus", "steel", "forging", "metallurgy"],
        3: ["assyrians", "siege", "empire", "iron"],
        4: ["conan", "comedy", "mcbride", "hang"]
    ]

    // MARK: Table-driven — deterministic single/short-word commands

    private struct DeterministicCase {
        let transcript: String
        let expected: IntentKind
        let line: UInt
        init(_ transcript: String, _ expected: IntentKind, line: UInt = #line) {
            self.transcript = transcript
            self.expected = expected
            self.line = line
        }
    }

    func testDeterministicCommandsTable() {
        let cases: [DeterministicCase] = [
            .init("skip", .skip),
            .init("skip this", .skip),
            .init("next", .skip),
            .init("next one", .skip),
            .init("back", .previous),
            .init("previous", .previous),
            .init("go back", .previous),
            .init("pause", .pause),
            .init("stop", .pause),
            .init("resume", .resume),
            .init("continue", .resume),
            .init("play", .resume),
            .init("play it", .resume),
            .init("more like this", .moreLikeThis),
            .init("more of this", .moreLikeThis),
            .init("something different", .somethingDifferent),
            .init("something else", .somethingDifferent),
            .init("not this", .somethingDifferent),
            .init("save this", .save),
            .init("save it", .save),
            .init("save for later", .save),
            .init("what is this", .whatIsThis),
            .init("what's this", .whatIsThis),
            .init("what am i listening to", .whatIsThis),
            .init("thumbs up", .thumbsUp),
            .init("i like this", .thumbsUp),
            .init("love this", .thumbsUp),
            .init("thumbs down", .thumbsDown),
            .init("i don't like this", .thumbsDown),
            .init("hate this", .thumbsDown),
            .init("faster", .faster),
            .init("speed up", .faster),
            .init("slower", .slower),
            .init("slow down", .slower),
            .init("family mode on", .familyModeOn),
            .init("kid mode on", .familyModeOn),
            .init("turn family mode on", .familyModeOn),
            .init("family mode off", .familyModeOff),
            .init("kid mode off", .familyModeOff),
            .init("skip intro", .skipIntroOnly),
            .init("just play", .skipIntroOnly)
        ]

        for testCase in cases {
            let result = IntentGrammar.parse(testCase.transcript)
            guard case .recognized(let kind) = result.outcome else {
                XCTFail("expected .recognized(\(testCase.expected)) for \"\(testCase.transcript)\", got \(result.outcome)", line: testCase.line)
                continue
            }
            XCTAssertEqual(kind, testCase.expected, "for transcript \"\(testCase.transcript)\"", line: testCase.line)
            XCTAssertEqual(result.confidence, 1.0, accuracy: 0.0001, "deterministic matches should be full confidence", line: testCase.line)
        }
    }

    // MARK: Noisy input

    func testNoisyInputUhSkipThis() {
        let result = IntentGrammar.parse("uh skip this")
        XCTAssertEqual(result.outcome, .recognized(.skip))
    }

    func testNoisyInputWithPunctuationAndCasing() {
        let result = IntentGrammar.parse("Uh, SKIP this!!")
        XCTAssertEqual(result.outcome, .recognized(.skip))
    }

    func testFillerWordsDoNotBlockPauseRecognition() {
        let result = IntentGrammar.parse("um, please just pause")
        XCTAssertEqual(result.outcome, .recognized(.pause))
    }

    // MARK: Ordinals beat fuzzy matches (05_CORNER_CASES.md #22)

    func testOrdinalNumberWordsResolveDirectlyToPlayOption() {
        XCTAssertEqual(IntentGrammar.parse("the first one").outcome, .recognized(.playOption(1)))
        XCTAssertEqual(IntentGrammar.parse("the second one").outcome, .recognized(.playOption(2)))
        XCTAssertEqual(IntentGrammar.parse("the third one").outcome, .recognized(.playOption(3)))
        XCTAssertEqual(IntentGrammar.parse("the fourth one").outcome, .recognized(.playOption(4)))
    }

    func testOptionCuePhrasesResolveToPlayOption() {
        XCTAssertEqual(IntentGrammar.parse("play option two").outcome, .recognized(.playOption(2)))
        XCTAssertEqual(IntentGrammar.parse("number three").outcome, .recognized(.playOption(3)))
        XCTAssertEqual(IntentGrammar.parse("card four").outcome, .recognized(.playOption(4)))
    }

    /// The core homophone/collision test from the spec: "the second one"
    /// (ordinal, unambiguous) vs "the segment one" (no ordinal token at
    /// all — "segment" must never be confused with "second").
    func testSecondVersusSegmentAreNotConfused() {
        let second = IntentGrammar.parse("the second one", cardKeywords: sampleCardKeywords)
        XCTAssertEqual(second.outcome, .recognized(.playOption(2)))

        let segment = IntentGrammar.parse("the segment one", cardKeywords: sampleCardKeywords)
        // "segment" doesn't appear in any sample card's keywords, so this
        // must NOT silently resolve to option 2 (or anything else) — it
        // should surface as unrecognized rather than guess.
        XCTAssertEqual(segment.outcome, .unrecognized)
    }

    func testOrdinalsWinEvenWhenAKeywordCoincidentallyMatchesADifferentSlot() {
        // Slot 4's keywords happen to contain the literal word "second"
        // (contrived, but exactly the scenario the spec calls out: an
        // ordinal must never lose to a fuzzy title match).
        let trickyKeywords: CardKeywords = [4: ["second", "opinion", "podcast"]]
        let result = IntentGrammar.parse("the second one", cardKeywords: trickyKeywords)
        XCTAssertEqual(result.outcome, .recognized(.playOption(2)), "ordinal must win over any fuzzy keyword collision")
    }

    // MARK: Fuzzy card-title matching

    func testFuzzyMatchOnFusionResolvesToSlotOneButAsksForConfirmationOnWeakOverlap() {
        // "play the fusion one" -> after stopword stripping, only "fusion"
        // remains as a content token: a single-keyword overlap is real but
        // not overwhelming, so this should ask for confirmation rather
        // than commit silently.
        let result = IntentGrammar.parse("play the fusion one", cardKeywords: sampleCardKeywords)
        guard case .needsConfirmation(let candidate, let prompt) = result.outcome else {
            return XCTFail("expected needsConfirmation, got \(result.outcome)")
        }
        XCTAssertEqual(candidate, .playOption(1))
        XCTAssertFalse(prompt.isEmpty)
        XCTAssertLessThan(result.confidence, 0.75)
    }

    func testFuzzyMatchWithStrongOverlapAutoAccepts() {
        // Two independent content-word hits against the same slot's
        // keyword list is strong enough evidence to act without asking.
        let result = IntentGrammar.parse("play the fusion reactor one", cardKeywords: sampleCardKeywords)
        XCTAssertEqual(result.outcome, .recognized(.playOption(1)))
        XCTAssertGreaterThanOrEqual(result.confidence, 0.75)
    }

    func testFuzzyMatchOnDamascusSteelResolvesToSlotTwo() {
        let result = IntentGrammar.parse("play the damascus steel one", cardKeywords: sampleCardKeywords)
        XCTAssertEqual(result.outcome, .recognized(.playOption(2)))
    }

    func testFuzzyMatchOnComedyHangResolvesToSlotFour() {
        let result = IntentGrammar.parse("play the conan comedy one", cardKeywords: sampleCardKeywords)
        XCTAssertEqual(result.outcome, .recognized(.playOption(4)))
    }

    func testAmbiguousTieBetweenTwoSlotsReducesConfidenceAndAsksForConfirmation() {
        let tiedKeywords: CardKeywords = [
            1: ["energy"],
            2: ["energy"]
        ]
        let result = IntentGrammar.parse("play the energy one", cardKeywords: tiedKeywords)
        guard case .needsConfirmation(_, let prompt) = result.outcome else {
            return XCTFail("expected needsConfirmation for a genuine tie, got \(result.outcome)")
        }
        XCTAssertFalse(prompt.isEmpty)
        XCTAssertLessThan(result.confidence, 0.5)
    }

    func testNoFuzzyMatchWithoutCardKeywordsNeverGuesses() {
        // "play the fusion one" with no session/cardKeywords loaded at all
        // must never fall back to generic resume — "fusion" is a leftover
        // content word that didn't resolve to anything.
        let result = IntentGrammar.parse("play the fusion one")
        XCTAssertEqual(result.outcome, .unrecognized)
    }

    // MARK: skip vs. skip-intro disambiguation (05_CORNER_CASES.md #21)

    func testSkipIntroPhrasingIsDistinctFromBareSkip() {
        XCTAssertEqual(IntentGrammar.parse("skip").outcome, .recognized(.skip))
        XCTAssertEqual(IntentGrammar.parse("skip intro").outcome, .recognized(.skipIntroOnly))
        XCTAssertEqual(IntentGrammar.parse("just play").outcome, .recognized(.skipIntroOnly))
    }

    // MARK: unrecognized / gibberish

    func testGibberishIsUnrecognizedNotGuessed() {
        let result = IntentGrammar.parse("asdkjfh qwjk zzz")
        XCTAssertEqual(result.outcome, .unrecognized)
        XCTAssertEqual(result.confidence, 0)
    }

    func testEmptyTranscriptIsUnrecognized() {
        let result = IntentGrammar.parse("   ")
        XCTAssertEqual(result.outcome, .unrecognized)
    }

    func testRawTranscriptIsPreservedVerbatimForLogging() {
        let result = IntentGrammar.parse("uh, SKIP this!!")
        XCTAssertEqual(result.rawTranscript, "uh, SKIP this!!")
    }
}
