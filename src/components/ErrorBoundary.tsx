import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
  parsedDetails: {
    error?: string;
    operationType?: string;
    path?: string | null;
  } | null;
}

const TypedComponent = Component as unknown as new (props: ErrorBoundaryProps) => {
  props: ErrorBoundaryProps;
  state: ErrorBoundaryState;
  setState: (
    next:
      | Partial<ErrorBoundaryState>
      | ((prev: ErrorBoundaryState) => Partial<ErrorBoundaryState>)
  ) => void;
};

export class ErrorBoundary extends TypedComponent {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
      parsedDetails: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let parsedDetails: ErrorBoundaryState['parsedDetails'] = null;
    try {
      const maybeJson = JSON.parse(error.message);
      if (maybeJson && typeof maybeJson === 'object' && 'operationType' in maybeJson) {
        parsedDetails = {
          error: maybeJson.error,
          operationType: maybeJson.operationType,
          path: maybeJson.path,
        };
      }
    } catch {
      // standard runtime error
    }

    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected application error occurred.',
      parsedDetails,
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Application ErrorBoundary caught error:', error, info);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      errorMessage: '',
      parsedDetails: null,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light p-4">
          <div className="card shadow-lg border-0" style={{ maxWidth: '560px', width: '100%', borderRadius: '14px' }}>
            <div className="card-header bg-danger text-white py-3 px-4 border-0" style={{ borderRadius: '14px 14px 0 0' }}>
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-shield-exclamation fs-4"></i>
                <h5 className="mb-0 fw-bold">Application &amp; Database Recovery</h5>
              </div>
            </div>
            <div className="card-body p-4">
              {this.state.parsedDetails ? (
                <div className="d-flex flex-column gap-2">
                  <p className="text-dark mb-1 fw-semibold">
                    A Firestore permission or validation constraint prevented this operation:
                  </p>
                  <div className="bg-light border rounded p-3 small">
                    <div><strong>Operation:</strong> {this.state.parsedDetails.operationType}</div>
                    <div><strong>Path:</strong> {this.state.parsedDetails.path || 'N/A'}</div>
                    <div className="text-danger mt-1"><strong>Details:</strong> {this.state.parsedDetails.error}</div>
                  </div>
                </div>
              ) : (
                <p className="text-muted mb-3">{this.state.errorMessage}</p>
              )}

              <div className="d-flex gap-2 mt-4">
                <button type="button" className="btn btn-primary btn-sm px-3" onClick={this.handleReset}>
                  <i className="bi bi-arrow-counterclockwise me-1"></i>Try Again
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm px-3"
                  onClick={() => window.location.reload()}
                >
                  <i className="bi bi-arrow-clockwise me-1"></i>Reload Platform
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
