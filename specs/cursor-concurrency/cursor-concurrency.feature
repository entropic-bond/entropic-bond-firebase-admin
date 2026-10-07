Feature: Concurrency-safe pagination cursor
  As an application issuing overlapping next() calls on one Firebase query
  I want each call to claim its page before waiting for the query
  So that concurrent callers receive consecutive pages without duplicates or gaps

  Background:
    Given a FirebaseAdminDatasource is the active data source
    And a "TestUser" document collection containing ordered documents "user1" to "user6"

  Scenario: Overlapping next calls receive consecutive pages. [REQ-1]
    Given a model for the "TestUser" collection
    When the model finds the first 2 documents
    And three next calls are requested concurrently
    Then the first call receives documents "user3" and "user4"
    And the second call receives documents "user5" and "user6"
    And the third call receives no documents

  Scenario: Concurrent next calls past the end of the result set all resolve to empty pages. [REQ-2]
    Given a model for the "TestUser" collection
    When the model finds all 6 documents
    And three next calls are requested concurrently
    Then every concurrent call receives no documents

  Scenario: An overlapping next call sizes its own page with its limit argument. [REQ-3]
    Given a model for the "TestUser" collection
    When the model finds the first 2 documents
    And two next calls requesting 1 document each are requested concurrently
    Then the first call receives document "user3"
    And the second call receives document "user4"

  Scenario: Each next call retrieves at most one page from the server. [REQ-4]
    Given a model for the "TestUser" collection
    When the model finds the first 2 documents
    And two next calls are requested concurrently
    Then every concurrent call receives at most 2 documents
