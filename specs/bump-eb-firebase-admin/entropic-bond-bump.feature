Feature: Bump entropic-bond to the latest v2.x release
  As a maintainer of @entropic-bond/firebase-admin
  I want the package to declare and resolve entropic-bond 2.0.4
  So that consumers pick up the fixes shipped in the 2.0.x patch line

  Scenario: The manifest declares the entropic-bond range ^2.0.4. [REQ-1]
    Given the package manifest of the project
    When the declared entropic-bond dependency range is read
    Then the range is "^2.0.4"

  Scenario: The lockfile resolves entropic-bond exactly to 2.0.4. [REQ-2]
    Given the package lockfile of the project
    When the locked entropic-bond version is read
    Then the version is "2.0.4"

  Scenario: Every other dependency keeps its previous declared range. [REQ-3]
    Given the package manifest of the project
    When the declared dependency ranges are read
    Then every dependency except entropic-bond keeps its previous range

  Scenario: The test suite passes against entropic-bond 2.0.4. [REQ-4]
    Given the project depends on entropic-bond "^2.0.4"
    When the test suite runs
    Then the suite passes

  Scenario: The build succeeds against entropic-bond 2.0.4. [REQ-5]
    Given the project depends on entropic-bond "^2.0.4"
    When the build runs
    Then the build succeeds
