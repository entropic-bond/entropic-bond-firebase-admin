# approved: 2026-10-23 (task brief ebfa-1: "don't stop at the gates")
Feature: Firestore listeners report changes in the core change vocabulary
  As an application observing a "TestUser" collection or document through FirebaseAdminDatasource
  I want every live notification to report creates, updates and deletes with the current matching snapshot
  So that models react to Firestore changes without translating Firebase event names

  Background:
    Given a FirebaseAdminDatasource is the active data source
    And a model for the "TestUser" collection
    And a "TestUser" document collection containing ordered documents "user1" to "user6" aged 23, 21, 56, 35, 41 and 40

  Scenario: Subscribing seeds the listener with the current matching documents. [REQ-1]
    Given a listener subscribed to the "TestUser" query matching all documents
    When the first notification arrives
    Then it is the only notification so far
    And it carries one "create" change per matching document, each with its document data in "after" and no "before" payload
    And its second argument is the full matching result with all six documents

  Scenario: A newly matching document is reported as a create change. [REQ-2]
    Given a listener subscribed to the "TestUser" query matching all documents
    And the listener has received its first notification
    When a matching document "user7" is written
    Then a single "create" change for "user7" is reported with its document data in "after"
    And the following snapshot contains "user7"

  Scenario: An updated document that still matches is reported as an update change. [REQ-3]
    Given a listener subscribed to the "TestUser" query matching all documents
    And the listener has received its first notification
    When the age of "user1" is set to 24
    Then a single "update" change for "user1" is reported with its new document data in "after"
    And the following snapshot contains "user1" with age 24

  Scenario: An updated document that no longer matches is reported as a delete change. [REQ-4]
    Given a listener subscribed to the "TestUser" query matching documents aged 20 or more
    And the listener has received its first notification
    When the age of "user1" is set to 10
    Then a single "delete" change for "user1" is reported
    And the following snapshot does not contain "user1"

  Scenario: A deleted matching document is reported as a delete change. [REQ-5]
    Given a listener subscribed to the "TestUser" query matching all documents
    And the listener has received its first notification
    When "user3" is deleted
    Then a single "delete" change for "user3" is reported with its last matching data in "after"
    And the following snapshot does not contain "user3"

  Scenario: Writing or deleting a document that does not match is not reported. [REQ-6]
    Given a listener subscribed to the "TestUser" query matching documents aged 30 or more
    And the listener has received its first notification
    When the age of "user1" is set to 24
    And "user2" is deleted
    Then no further notification reaches the listener

  Scenario: A limited and sorted query observes only its window. [REQ-7]
    Given a listener subscribed to the "TestUser" query sorted by age ascending with limit 3
    When the first notification arrives
    Then it carries three "create" changes for "user2", "user1" and "user4" in that order
    And its snapshot is exactly those three documents in that order

  Scenario: A write that pushes a document out of a limited window is reported as a delete change. [REQ-8]
    Given a listener subscribed to the "TestUser" query sorted by age ascending with limit 3
    And the listener has received its first notification
    When the age of "user2" is set to 100
    Then a "delete" change for "user2" is reported
    And the following snapshot is "user1", "user4" and "user6" in that order

  Scenario: A document deleted inside a transaction is reported as a delete change. [REQ-9]
    Given a listener subscribed to the "TestUser" query matching all documents
    And the listener has received its first notification
    When a transaction deletes "user6"
    Then a "delete" change for "user6" is reported
    And the following snapshot does not contain "user6"

  Scenario: An unsubscribed listener is not notified by later writes. [REQ-10]
    Given a listener subscribed to the "TestUser" query matching all documents
    And the listener has received its first notification
    When the subscription is unsubscribed
    And a matching document "user7" is written
    And "user3" is deleted
    Then no further notification reaches the listener

  Scenario Outline: Every reported change uses the core vocabulary and names its collection. [REQ-11]
    Given a listener subscribed to the "TestUser" query matching all documents
    And the listener has received its first notification
    When <event>
    Then every reported change has type "<type>", collection path "TestUser" and no "before" payload

    Examples:
      | event                          | type   |
      | a matching document is added    | create |
      | a matching document is changed  | update |
      | a matching document is deleted  | delete |

  Scenario: A query matching no documents notifies once with an empty result. [REQ-12]
    Given a listener subscribed to the "TestUser" query matching documents aged 200 or more
    When the first notification arrives
    Then it is the only notification so far
    And it carries no changes
    And its snapshot is empty

  Scenario: The documents delivered to a model listener are model instances. [REQ-13]
    Given a listener subscribed through the model to the "TestUser" query matching all documents
    And the listener has received its first notification
    When a matching document "user7" is written
    Then the "after" payload of the reported change is a "TestUser" instance
    And every entry of the following snapshot is a "TestUser" instance

  Scenario: Subscribing to an existing document reports an update with the document. [REQ-14]
    Given a document listener subscribed to "user1"
    When the first notification arrives
    Then a single "update" change carrying "user1" is reported
    And its "exists" parameter is true

  Scenario: Subscribing to a missing document stays silent until it is created. [REQ-15]
    Given a document listener subscribed to "user7" which does not exist
    When "user7" is written
    Then a single "update" change carrying "user7" is reported
    And its "exists" parameter is true

  Scenario: Changing the observed document is reported as an update. [REQ-16]
    Given a document listener subscribed to "user6"
    And the listener has received its first notification
    When the age of "user6" is set to 77
    Then a single "update" change for "user6" with age 77 is reported
    And its "exists" parameter is true

  Scenario: Deleting the observed document is reported as a delete. [REQ-17]
    Given a document listener subscribed to "user6"
    And the listener has received its first notification
    When "user6" is deleted
    Then a single "delete" change for "user6" is reported
    And it carries no "after" payload
    And its "exists" parameter is false

  Scenario: An unsubscribed document listener is not notified by later writes. [REQ-18]
    Given a document listener subscribed to "user6"
    And the listener has received its first notification
    When the subscription is unsubscribed
    And the age of "user6" is set to 77
    And "user6" is deleted
    Then no further notification reaches the listener

  Scenario: A document change delivered to a model listener carries a model instance. [REQ-19]
    Given a document listener subscribed through the model to "user6"
    And the listener has received its first notification
    When the age of "user6" is set to 77
    Then the "after" payload of the reported change is a "TestUser" instance with age 77
