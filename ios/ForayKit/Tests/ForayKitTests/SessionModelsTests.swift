import XCTest
@testable import ForayKit

/// Decodes the real `data/session.json` (copied verbatim into
/// Fixtures/session_fixture.json — keep the two in sync) and asserts on
/// specific known values, so a field-name or type mismatch between
/// `SessionModels.swift` and the actual document format fails a test
/// instead of silently losing data on device.
final class SessionModelsTests: XCTestCase {

    private func loadFixtureData() throws -> Data {
        guard let url = Bundle.module.url(forResource: "session_fixture", withExtension: "json") else {
            XCTFail("Missing session_fixture.json in test bundle resources")
            return Data()
        }
        return try Data(contentsOf: url)
    }

    func testDecodesTopLevelFields() throws {
        let data = try loadFixtureData()
        let session = try Session.decode(from: data)

        XCTAssertEqual(session.version, 1)
        XCTAssertEqual(session.sessionID, "2026-07-08-morning")
        XCTAssertEqual(session.builtAtRaw, "2026-07-08T04:30:00-07:00")
        XCTAssertNotNil(session.builtAt, "builtAtRaw should parse as an ISO-8601 date")

        XCTAssertEqual(session.commute.minutes, 18)
        XCTAssertEqual(session.commute.playbackSpeed, 1.5)
        XCTAssertEqual(session.commute.contentMinutes, 27)
    }

    func testUnsupportedVersionThrows() throws {
        let json = """
        { "version": 2, "session_id": "x", "built_at": "x", "commute": {"minutes":1,"playback_speed":1,"content_minutes":1}, "cards": [], "categories": [], "episodes": {} }
        """.data(using: .utf8)!

        XCTAssertThrowsError(try Session.decode(from: json)) { error in
            XCTAssertEqual(error as? SessionDecodeError, .unsupportedVersion(2))
        }
    }

    func testDecodesAllFourCardsWithCorrectArchetypes() throws {
        let data = try loadFixtureData()
        let session = try Session.decode(from: data)

        XCTAssertEqual(session.cards.count, 4)

        let bySlot = Dictionary(uniqueKeysWithValues: session.cards.map { ($0.slot, $0) })

        XCTAssertEqual(bySlot[1]?.archetype, .deepLearn)
        XCTAssertEqual(bySlot[1]?.episodeID, "lex-353-whyte")
        XCTAssertEqual(bySlot[1]?.alternates.count, 5)
        XCTAssertTrue(bySlot[1]?.whyLine.contains("SPARC") ?? false)

        XCTAssertEqual(bySlot[2]?.archetype, .stretch)
        XCTAssertEqual(bySlot[2]?.episodeID, "sysk-damascus-steel")

        XCTAssertEqual(bySlot[3]?.archetype, .narrative)
        XCTAssertEqual(bySlot[3]?.episodeID, "foc-assyrians")

        XCTAssertEqual(bySlot[4]?.archetype, .comfort)
        XCTAssertEqual(bySlot[4]?.episodeID, "conan-mcbride-returns")
    }

    func testUnknownArchetypeDecodesAsOtherInsteadOfThrowing() throws {
        let json = """
        {"slot": 5, "archetype": "wildcard", "archetype_label": "Wildcard", "episode_id": "e1", "why_line": "w", "fit_line": "f", "alternates": []}
        """.data(using: .utf8)!
        let card = try JSONDecoder().decode(SessionCard.self, from: json)
        XCTAssertEqual(card.archetype, .other("wildcard"))
        XCTAssertEqual(card.archetype.rawValue, "wildcard")
    }

    func testDecodesCategoriesAndGroups() throws {
        let data = try loadFixtureData()
        let session = try Session.decode(from: data)

        XCTAssertEqual(session.categories.count, 4)
        let fusionTour = session.categories.first { $0.id == "fusion-tour" }
        XCTAssertNotNil(fusionTour)
        XCTAssertEqual(fusionTour?.groups.count, 6)
        let tokamaks = fusionTour?.groups.first { $0.label == "Tokamaks" }
        XCTAssertEqual(tokamaks?.episodeIDs.count, 4)
        XCTAssertTrue(tokamaks?.episodeIDs.contains("lex-353-whyte") ?? false)
    }

    func testDecodesEpisodesDictionaryWithOptionalFields() throws {
        let data = try loadFixtureData()
        let session = try Session.decode(from: data)

        XCTAssertEqual(session.episodes.count, 27)

        // Episode with a large apple_track_id, non-empty reactor_types.
        let whyte = try XCTUnwrap(session.episodes["lex-353-whyte"])
        XCTAssertEqual(whyte.show, "Lex Fridman Podcast")
        XCTAssertEqual(whyte.durationMin, 194)
        XCTAssertEqual(whyte.appleTrackID, 1_000_595_885_259)
        XCTAssertEqual(whyte.depth, .high)
        XCTAssertEqual(whyte.format, .interview)
        XCTAssertEqual(whyte.reactorTypes, ["Tokamak", "SPARC", "ITER"])

        // Episode with a null apple_track_id and no reactor_types field at all.
        let insideChips = try XCTUnwrap(session.episodes["insidechips-semi-mfg"])
        XCTAssertNil(insideChips.appleTrackID)
        XCTAssertEqual(insideChips.reactorTypes, [])
        XCTAssertEqual(insideChips.format, .panel)

        // A comedy/hang episode with low depth.
        let conan = try XCTUnwrap(session.episodes["conan-mcbride-returns"])
        XCTAssertEqual(conan.depth, .low)
        XCTAssertEqual(conan.format, .hang)
        XCTAssertEqual(conan.topics, ["comedy/casual-hangs"])
    }

    func testRoundTripEncodeDecodeIsLossless() throws {
        let data = try loadFixtureData()
        let session = try Session.decode(from: data)

        let reencoded = try JSONEncoder().encode(session)
        let roundTripped = try JSONDecoder().decode(Session.self, from: reencoded)

        XCTAssertEqual(session, roundTripped)
    }
}
