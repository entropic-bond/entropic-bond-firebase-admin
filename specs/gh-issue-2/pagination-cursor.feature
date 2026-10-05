Feature: Per-query pagination cursors in FirebaseAdminDatasource
  As an application using the Firebase Admin data source
  I want each Firebase query to own its pagination cursor
  So that interleaved find/next calls on a single data source do not mix result sets

  Background:
    Given a FirebaseAdminDatasource is the active data source
    And a "TestUser" document collection containing ordered documents "user1" to "user6"

  Scenario: Continue a model's own query with next. Issue: #2 [REQ-1]
    Given a model for the "TestUser" collection
    When the model finds the first 2 documents
    And the model requests the next page
    Then the model receives documents "user3" and "user4"

  Scenario: Interleaved pagination on two models of one collection keeps each result set. Issue: #2 [REQ-2]
    Given two models for the "TestUser" collection
    When the first model finds the first 2 documents
    And the second model finds the first 3 documents
    And the first model requests the next page
    And the second model requests the next page
    Then the first model receives documents "user3" and "user4"
    And the second model receives documents "user4", "user5" and "user6"

  Scenario: Interleaved pagination across collections does not mix result sets. Issue: #2 [REQ-3]
    Given a model for the "TestUser" collection
    And a model for the "SubClass" collection containing ordered documents "sub1" to "sub3"
    When the first model finds the first 2 documents
    And the second model finds the first document
    And the first model requests the next page
    Then the first model receives documents "user3" and "user4"

  Scenario: Re-running a query resets pagination for that model only. Issue: #2 [REQ-4]
    Given two models for the "TestUser" collection
    When the first model finds the first 2 documents
    And the second model finds the first 2 documents
    And the first model finds all documents
    And the second model requests the next page
    Then the second model receives documents "user3" and "user4"

  Scenario: A count query between pages does not disturb an in-progress cursor. Issue: #2 [REQ-5]
    Given a model for the "TestUser" collection
    When the model finds the first 2 documents
    And the model counts the documents matching the same query
    And the model requests the next page
    Then the model receives documents "user3" and "user4"
