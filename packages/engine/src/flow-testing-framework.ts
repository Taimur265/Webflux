/**
 * Flow Testing Framework
 * Comprehensive testing for workflows with assertions and mocking
 */

import type { Flow, ExecutionReport, Node } from '@uwg/schema';
import { FlowExecutor } from './executor';
import type { ConnectorRegistry } from '@uwg/connectors';

export interface TestCase {
  name: string;
  description: string;
  input: any;
  expectedOutput?: any;
  assertions: Assertion[];
  mock?: {
    [connector: string]: {
      [operation: string]: any;
    };
  };
  timeout?: number;
}

export interface Assertion {
  type: 'equals' | 'contains' | 'matches' | 'exists' | 'custom';
  path: string; // JSON path to value
  expected?: any;
  customFn?: (actual: any) => boolean;
  message?: string;
}

export interface TestResult {
  testName: string;
  passed: boolean;
  duration: number;
  assertions: AssertionResult[];
  error?: string;
  executionReport?: ExecutionReport;
}

export interface AssertionResult {
  assertion: Assertion;
  passed: boolean;
  actual: any;
  expected: any;
  message: string;
}

export interface TestSuite {
  name: string;
  description: string;
  flow: Flow;
  tests: TestCase[];
  beforeEach?: () => Promise<void>;
  afterEach?: () => Promise<void>;
}

export interface TestSuiteResult {
  suiteName: string;
  total: number;
  passed: number;
  failed: number;
  duration: number;
  results: TestResult[];
  coverage?: CoverageReport;
}

export interface CoverageReport {
  nodes: {
    [nodeId: string]: {
      executed: boolean;
      executionCount: number;
    };
  };
  edges: {
    [edgeKey: string]: {
      traversed: boolean;
      traversalCount: number;
    };
  };
  totalNodes: number;
  executedNodes: number;
  coveragePercentage: number;
}

/**
 * Mock connector for testing
 */
class MockConnector {
  private mocks: Map<string, any> = new Map();

  setMock(operation: string, response: any): void {
    this.mocks.set(operation, response);
  }

  async call(operation: string, params: any): Promise<any> {
    if (this.mocks.has(operation)) {
      const mock = this.mocks.get(operation);

      // If mock is a function, call it
      if (typeof mock === 'function') {
        return mock(params);
      }

      return mock;
    }

    throw new Error(`No mock defined for operation: ${operation}`);
  }
}

/**
 * Flow Testing Framework
 */
export class FlowTestingFramework {
  private executor: FlowExecutor;
  private mockConnectors: Map<string, MockConnector> = new Map();
  private coverage: Map<string, CoverageReport> = new Map();

  constructor(connectorRegistry: ConnectorRegistry) {
    this.executor = new FlowExecutor(connectorRegistry);
  }

  /**
   * Run a test suite
   */
  async runSuite(suite: TestSuite): Promise<TestSuiteResult> {
    console.log(`\n🧪 Running test suite: ${suite.name}`);
    console.log(`📝 ${suite.description}\n`);

    const results: TestResult[] = [];
    const startTime = Date.now();

    // Initialize coverage tracking
    this.initializeCoverage(suite.flow);

    for (const test of suite.tests) {
      // Run beforeEach hook
      if (suite.beforeEach) {
        await suite.beforeEach();
      }

      // Run test
      const result = await this.runTest(suite.flow, test);
      results.push(result);

      // Update coverage
      if (result.executionReport) {
        this.updateCoverage(suite.flow.flow_id || 'unknown', result.executionReport);
      }

      // Run afterEach hook
      if (suite.afterEach) {
        await suite.afterEach();
      }

      // Log result
      this.logTestResult(result);
    }

    const duration = Date.now() - startTime;
    const passed = results.filter(r => r.passed).length;
    const failed = results.length - passed;

    // Get coverage report
    const coverage = this.coverage.get(suite.flow.flow_id || 'unknown');

    const suiteResult: TestSuiteResult = {
      suiteName: suite.name,
      total: results.length,
      passed,
      failed,
      duration,
      results,
      coverage,
    };

    this.logSuiteResult(suiteResult);

    return suiteResult;
  }

  /**
   * Run a single test case
   */
  private async runTest(flow: Flow, test: TestCase): Promise<TestResult> {
    const startTime = Date.now();

    try {
      // Setup mocks
      if (test.mock) {
        this.setupMocks(test.mock);
      }

      // Execute flow
      const report = await this.executor.execute(
        flow,
        {
          parallelism: 1, // Sequential for testing
          max_execution_time: test.timeout || 60000,
        },
        test.input
      );

      // Run assertions
      const assertions = this.runAssertions(report, test.assertions);

      const passed = assertions.every(a => a.passed);
      const duration = Date.now() - startTime;

      return {
        testName: test.name,
        passed,
        duration,
        assertions,
        executionReport: report,
      };
    } catch (error: any) {
      return {
        testName: test.name,
        passed: false,
        duration: Date.now() - startTime,
        assertions: [],
        error: error.message,
      };
    }
  }

  /**
   * Run assertions on execution report
   */
  private runAssertions(report: ExecutionReport, assertions: Assertion[]): AssertionResult[] {
    return assertions.map(assertion => {
      try {
        const actual = this.getValueByPath(report.outputs, assertion.path);

        let passed = false;
        let message = assertion.message || `Assertion failed: ${assertion.type}`;

        switch (assertion.type) {
          case 'equals':
            passed = JSON.stringify(actual) === JSON.stringify(assertion.expected);
            message = passed
              ? `✓ ${assertion.path} equals expected value`
              : `✗ ${assertion.path}: expected ${JSON.stringify(assertion.expected)}, got ${JSON.stringify(actual)}`;
            break;

          case 'contains':
            if (Array.isArray(actual)) {
              passed = actual.includes(assertion.expected);
            } else if (typeof actual === 'string') {
              passed = actual.includes(assertion.expected);
            } else if (typeof actual === 'object') {
              passed = JSON.stringify(actual).includes(JSON.stringify(assertion.expected));
            }
            message = passed
              ? `✓ ${assertion.path} contains expected value`
              : `✗ ${assertion.path} does not contain ${JSON.stringify(assertion.expected)}`;
            break;

          case 'matches':
            const regex = new RegExp(assertion.expected);
            passed = regex.test(String(actual));
            message = passed
              ? `✓ ${assertion.path} matches pattern`
              : `✗ ${assertion.path} does not match pattern ${assertion.expected}`;
            break;

          case 'exists':
            passed = actual !== undefined && actual !== null;
            message = passed
              ? `✓ ${assertion.path} exists`
              : `✗ ${assertion.path} does not exist`;
            break;

          case 'custom':
            if (assertion.customFn) {
              passed = assertion.customFn(actual);
              message = passed
                ? `✓ Custom assertion passed`
                : `✗ Custom assertion failed`;
            }
            break;
        }

        return {
          assertion,
          passed,
          actual,
          expected: assertion.expected,
          message,
        };
      } catch (error: any) {
        return {
          assertion,
          passed: false,
          actual: undefined,
          expected: assertion.expected,
          message: `✗ Assertion error: ${error.message}`,
        };
      }
    });
  }

  /**
   * Get value by JSON path
   */
  private getValueByPath(obj: any, path: string): any {
    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (current === undefined || current === null) {
        return undefined;
      }

      // Handle array indices
      const match = part.match(/^(.+)\[(\d+)\]$/);
      if (match) {
        current = current[match[1]];
        if (Array.isArray(current)) {
          current = current[parseInt(match[2])];
        }
      } else {
        current = current[part];
      }
    }

    return current;
  }

  /**
   * Setup mocks for connectors
   */
  private setupMocks(mocks: TestCase['mock']): void {
    if (!mocks) return;

    for (const [connector, operations] of Object.entries(mocks)) {
      let mockConnector = this.mockConnectors.get(connector);

      if (!mockConnector) {
        mockConnector = new MockConnector();
        this.mockConnectors.set(connector, mockConnector);
      }

      for (const [operation, response] of Object.entries(operations)) {
        mockConnector.setMock(operation, response);
      }
    }
  }

  /**
   * Initialize coverage tracking
   */
  private initializeCoverage(flow: Flow): void {
    const flowId = flow.flow_id || 'unknown';

    const coverage: CoverageReport = {
      nodes: {},
      edges: {},
      totalNodes: flow.graph.nodes.length,
      executedNodes: 0,
      coveragePercentage: 0,
    };

    // Initialize node coverage
    flow.graph.nodes.forEach(node => {
      coverage.nodes[node.id] = {
        executed: false,
        executionCount: 0,
      };
    });

    // Initialize edge coverage
    flow.graph.edges.forEach(edge => {
      const key = `${edge.from}->${edge.to}`;
      coverage.edges[key] = {
        traversed: false,
        traversalCount: 0,
      };
    });

    this.coverage.set(flowId, coverage);
  }

  /**
   * Update coverage from execution report
   */
  private updateCoverage(flowId: string, report: ExecutionReport): void {
    const coverage = this.coverage.get(flowId);
    if (!coverage) return;

    // Update node coverage
    report.logs.forEach(log => {
      if (log.node_id && coverage.nodes[log.node_id]) {
        coverage.nodes[log.node_id].executed = true;
        coverage.nodes[log.node_id].executionCount++;
      }
    });

    // Calculate coverage percentage
    coverage.executedNodes = Object.values(coverage.nodes).filter(n => n.executed).length;
    coverage.coveragePercentage = (coverage.executedNodes / coverage.totalNodes) * 100;
  }

  /**
   * Generate test report
   */
  generateReport(suiteResults: TestSuiteResult[]): string {
    let report = '\n';
    report += '═══════════════════════════════════════════════════════\n';
    report += '           FLOW TEST REPORT\n';
    report += '═══════════════════════════════════════════════════════\n\n';

    let totalTests = 0;
    let totalPassed = 0;
    let totalFailed = 0;
    let totalDuration = 0;

    suiteResults.forEach(suite => {
      totalTests += suite.total;
      totalPassed += suite.passed;
      totalFailed += suite.failed;
      totalDuration += suite.duration;

      report += `Suite: ${suite.suiteName}\n`;
      report += `  Tests: ${suite.passed}/${suite.total} passed\n`;
      report += `  Duration: ${suite.duration}ms\n`;

      if (suite.coverage) {
        report += `  Coverage: ${suite.coverage.coveragePercentage.toFixed(2)}% (${suite.coverage.executedNodes}/${suite.coverage.totalNodes} nodes)\n`;
      }

      report += '\n';
    });

    report += '───────────────────────────────────────────────────────\n';
    report += `Total Tests: ${totalTests}\n`;
    report += `Passed: ${totalPassed} (${((totalPassed / totalTests) * 100).toFixed(2)}%)\n`;
    report += `Failed: ${totalFailed} (${((totalFailed / totalTests) * 100).toFixed(2)}%)\n`;
    report += `Duration: ${totalDuration}ms\n`;
    report += '═══════════════════════════════════════════════════════\n';

    return report;
  }

  /**
   * Log test result
   */
  private logTestResult(result: TestResult): void {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.testName} (${result.duration}ms)`);

    if (!result.passed) {
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }

      result.assertions.forEach(assertion => {
        if (!assertion.passed) {
          console.log(`   ${assertion.message}`);
        }
      });
    }
  }

  /**
   * Log suite result
   */
  private logSuiteResult(result: TestSuiteResult): void {
    console.log(`\n📊 Test Suite Results:`);
    console.log(`   Total: ${result.total}`);
    console.log(`   Passed: ${result.passed}`);
    console.log(`   Failed: ${result.failed}`);
    console.log(`   Duration: ${result.duration}ms`);

    if (result.coverage) {
      console.log(`   Coverage: ${result.coverage.coveragePercentage.toFixed(2)}%`);
    }

    console.log('');
  }

  /**
   * Get coverage report
   */
  getCoverageReport(flowId: string): CoverageReport | undefined {
    return this.coverage.get(flowId);
  }
}
