Feature: Transaction failures keep their real cause
  As an application running compare-and-set transactions through FirebaseAdminDatasource
  I want only a transaction that could not commit because of concurrent modification to be reported as a conflict
  So that every other failure reaches the caller and the logs instead of being retried and hidden as a conflict

  Background:
    Given a FirebaseAdminDatasource is the active data source
    And a "TestUser" document collection containing ordered documents "user1" to "user6"

  Scenario: A commit failure that cannot succeed on a retry keeps its own error. [REQ-1]
    Given a model for the "TestUser" collection
    And a document whose serialized value exceeds the Firestore size limit
    When the model commits that document inside a transaction
    Then the transaction rejects with the INVALID_ARGUMENT size error
    And the rejection is not a TransactionConflictError

  Scenario: A failure raised by the transaction callback keeps its own error. [REQ-2]
    Given a model for the "TestUser" collection
    And an application error raised by the transaction callback
    When that callback fails
    Then the transaction rejects with that same error
    And the rejection is not a TransactionConflictError

  Scenario Outline: A transaction aborted by contention is reported as a transaction conflict. [REQ-3]
    Given a failure carrying status code <code> and message "<message>"
    When the datasource classifies that failure
    Then the failure is a transaction conflict

    Examples:
      | code | message                 |
      | 10   | the transaction aborted |
      | 409  | http aborted            |
      | 3    | transaction has expired |

  Scenario Outline: Any other failure is not a transaction conflict. [REQ-4]
    Given a failure carrying status code <code> and message "<message>"
    When the datasource classifies that failure
    Then the failure is not a transaction conflict

    Examples:
      | code | message                             |
      | 3    | longer than 1048487 bytes           |
      | 7    | missing or insufficient permissions |
      | 14   | unavailable                         |
      | 8    | resource exhausted                  |
      |      | a plain error without status code   |
