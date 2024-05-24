import React, { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import PropTypes from "prop-types";
import {
  PENDING,
  ACTIVE,
  HERMIT,
  COLDCARD,
  INDIRECT_KEYSTORES,
} from "@caravan/wallets";
import {
  Box,
  Typography,
  Card,
  CardHeader,
  CardContent,
  CardActions,
  Button,
  CircularProgress,
} from "@mui/material";
import {
  ThumbUp as SuccessIcon,
  ThumbDown as FailureIcon,
  Error as ErrorIcon,
} from "@mui/icons-material";
import moment from "moment";
import Test from "../../tests/Test.js";
import {
  startTestRun as startTestRunAction,
  endTestRun as endTestRunAction,
  resetTestRun as resetTestRunAction,
} from "../../actions/testRunActions.ts";
import { setErrorNotification as setErrorNotificationAction } from "../../actions/errorNotificationActions.ts";
import InteractionMessages from "../InteractionMessages.jsx";
import { TestRunNote } from "./Note.tsx";
import { HermitReader, HermitDisplayer } from "../Hermit/index.js";
import {
  ColdcardJSONReader,
  ColdcardPSBTReader,
  ColdcardSigningButtons,
} from "../Coldcard/index.js";
import "./TestRun.css";
import { downloadFile } from "../../utils/index.js";

import { getKeystore } from "../../selectors/keystore.ts";
import { getTestSuiteRun } from "../../selectors/testSuiteRun.ts";

const SPACEBAR_CODE = 32;

// interface TestRunProps {
//   testRunIndex: number;
//   isLastTest: boolean;
//   nextTest: () => boolean;
// }

const TestRun = ({ testRunIndex, isLastTest, nextTest }) => {
  // const TestRun = ({ testRunIndex, isLastTest, nextTest }: TestRunProps) => {
  const keystore = useSelector(getKeystore);
  const { status, message, test } =
    useSelector(getTestSuiteRun).testRuns[testRunIndex];
  const dispatch = useDispatch();

  const handleKeyDown = (event) => {
    if (event.keyCode !== SPACEBAR_CODE) {
      return;
    }
    if (event.target.tagName.toLowerCase() === "textarea") {
      return;
    }
    event.preventDefault();
    if (status === ACTIVE) {
      return;
    }
    if (status === PENDING) {
      start();
    } else if (!isLastTest) {
      nextTest();
    }
  };

  const handleDownloadPSBTClick = () => {
    const interaction = test.interaction();
    const nameBits = test.name().split(" ");
    const body = interaction.request();
    const timestamp = moment().format("HHmm");
    const filename = `${timestamp}-${nameBits[2]}-${nameBits[1][0]}.psbt`;
    downloadFile(body, filename);
  };

  const handledDownloadWalletConfigClick = () => {
    const nameBits = test.name().split(" ");
    const name = `${nameBits[2].toLowerCase()}-${nameBits[1][0]}`;
    // FIXME - need to know firmware version and then set P2WSH-P2SH vs P2SH-P2WSH appropriately
    //   leaving it as P2WSH-P2SH for now.
    let output = `# Coldcard Multisig setup file for test suite
#
Name: ${name}
Policy: 2 of 2
Format: ${test.params.format.includes("-") ? "P2WSH-P2SH" : test.params.format}
Derivation: ${test.params.derivation}

`;
    // We need to loop over xpubs and output `xfp: xpub` for each
    const xpubs = test.params.extendedPublicKeys.map(
      (xpub) => `${xpub.rootFingerprint}: ${xpub.base58String}`,
    );
    output += xpubs.join("\r\n");
    output += "\r\n";
    const filename = `wc-${name}.txt`;
    downloadFile(output, filename);
  };

  const testComplete = () => {
    return (
      status === Test.SUCCESS ||
      status === Test.ERROR ||
      status === Test.FAILURE
    );
  };

  const renderInteractionMessages = () => {
    if (status === PENDING || status === ACTIVE) {
      return (
        <InteractionMessages
          excludeCodes={["hermit.command"]}
          messages={test.interaction().messagesFor({ state: status })}
        />
      );
    }
    return null;
  };

  const renderResult = () => {
    switch (status) {
      case Test.SUCCESS:
        return (
          <Box mt={2} align="center">
            <Typography variant="h5" className="TestRun-success">
              <SuccessIcon />
              &nbsp; Test passed
            </Typography>
          </Box>
        );
      case Test.FAILURE:
        return (
          <Box mt={2}>
            <Box align="center">
              <Typography variant="h5" className="TestRun-failure">
                <FailureIcon />
                &nbsp; Test failed
              </Typography>
            </Box>
            {message}
          </Box>
        );
      case Test.ERROR:
        return (
          <Box mt={2}>
            <Box align="center">
              <Typography variant="h5" className="TestRun-error">
                <ErrorIcon />
                &nbsp; Test error
              </Typography>
            </Box>
            {message}
          </Box>
        );
      default:
        return null;
    }
  };

  const start = async () => {
    dispatch(startTestRunAction(testRunIndex));
    if (keystore.type === HERMIT) {
      return;
    }
    const result = await test.run();
    handleResult(result);
  };

  const startParse = async (data) => {
    dispatch(startTestRunAction(testRunIndex));
    const result = await test.runParse(data);
    handleResult(result);
  };

  const resolve = (actual) => {
    const result = test.resolve(test.postprocess(actual));
    handleResult(result);
  };

  const handleResult = (result) => {
    if (result.status === Test.ERROR) {
      dispatch(setErrorNotificationAction(result.message));
    }
    dispatch(
      endTestRunAction(testRunIndex, result.status, formatMessage(result)),
    );
  };

  const reset = () => {
    dispatch(resetTestRunAction(testRunIndex));
  };

  const formatMessage = (result) => {
    switch (result.status) {
      case Test.FAILURE:
        return (
          <Box>
            <dl>
              <dt>Expected:</dt>
              <dd>
                <code className="TestRun-wrap">
                  {formatOutput(result.expected)}
                </code>
              </dd>
              <dt>Actual:</dt>
              <dd>
                <code className="TestRun-wrap">
                  {formatOutput(result.actual)}
                </code>
              </dd>
              {result.diff && (
                <div>
                  <dt>Diff:</dt>
                  <dd>
                    <code className="TestRun-wrap">
                      {result.diff.map(formatDiffSegment)}
                    </code>
                  </dd>
                </div>
              )}
            </dl>
          </Box>
        );
      case Test.ERROR:
        return <code>{result.message}</code>;
      default:
        return "";
    }
  };

  const formatOutput = (output) => {
    switch (typeof output) {
      case "object":
        return JSON.stringify(output);
      case "string":
      case "number":
        return output;
      default:
        return "Did not recognize output type";
    }
  };

  const formatDiffSegment = (segment, i) => {
    return (
      <span
        key={i}
        className={`TestRun-diff-segment-${diffSegmentClass(segment)}`}
      >
        {segment.value}
      </span>
    );
  };

  const diffSegmentClass = (segment) => {
    if (segment.added) {
      return "added";
    }
    if (segment.removed) {
      return "removed";
    }
    return "common";
  };

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  });

  if (!test) {
    return (
      <Box>
        <p>No test selected.</p>
      </Box>
    );
  }
  return (
    <Box>
      <Card>
        <CardHeader
          title={test.name()}
          subheader={`Test ${testRunIndex + 1}`}
        />
        <CardContent>
          {test.description()}
          {keystore.type === COLDCARD && !test.unsignedTransaction && (
            <Box align="center">
              <ColdcardJSONReader
                interaction={test.interaction()}
                onReceive={startParse}
                onStart={start}
                setError={reset}
                isTest
              />
            </Box>
          )}
          {keystore.type === COLDCARD && test.unsignedTransaction && (
            <Box align="center" style={{ marginTop: "2em" }}>
              <ColdcardSigningButtons
                handlePSBTDownloadClick={handleDownloadPSBTClick}
                handleWalletConfigDownloadClick={
                  handledDownloadWalletConfigClick
                }
              />
              <ColdcardPSBTReader
                interaction={test.interaction()}
                onReceivePSBT={startParse}
                onStart={start}
                setError={reset}
                fileType="PSBT"
                validFileFormats=".psbt"
              />
            </Box>
          )}
          {renderInteractionMessages()}
          {status === PENDING &&
            !Object.values(INDIRECT_KEYSTORES).includes(keystore.type) && (
              <Box align="center">
                <Button variant="contained" color="primary" onClick={start}>
                  Start Test
                </Button>
              </Box>
            )}
          {keystore.type === HERMIT &&
            test.interaction().workflow[0] === "request" &&
            status === PENDING && (
              <Box align="center">
                <HermitDisplayer
                  width={400}
                  parts={test.interaction().request()}
                />
              </Box>
            )}
          {keystore.type === HERMIT && !testComplete() && (
            <Box>
              <HermitReader
                onStart={start}
                onSuccess={resolve}
                onClear={reset}
                startText="Scan QR Codes From Hermit"
                interaction={test.interaction()}
              />
            </Box>
          )}
          {testComplete() && renderResult()}

          <TestRunNote />
        </CardContent>
        <CardActions>
          {status === ACTIVE && (
            <Button disabled>
              <CircularProgress />
              &nbsp; Running test...
            </Button>
          )}
          {testComplete() && (
            <Button variant="text" color="error" onClick={reset}>
              Reset Test
            </Button>
          )}
        </CardActions>
      </Card>
    </Box>
  );
};

TestRun.propTypes = {
  endTestRun: PropTypes.func.isRequired,
  isLastTest: PropTypes.bool.isRequired,
  keystore: PropTypes.shape({
    type: PropTypes.string.isRequired,
  }).isRequired,
  message: PropTypes.oneOfType([PropTypes.string, PropTypes.shape({})])
    .isRequired,
  nextTest: PropTypes.func.isRequired,
  resetTestRun: PropTypes.func.isRequired,
  testRunIndex: PropTypes.number.isRequired,
  test: PropTypes.shape({
    name: PropTypes.func.isRequired,
    description: PropTypes.func.isRequired,
    interaction: PropTypes.func.isRequired,
    params: PropTypes.shape({
      format: PropTypes.string,
      derivation: PropTypes.string,
      extendedPublicKeys: PropTypes.array,
    }),
    run: PropTypes.func.isRequired,
    runParse: PropTypes.func.isRequired,
    resolve: PropTypes.func.isRequired,
    postprocess: PropTypes.func.isRequired,
    unsignedTransaction: PropTypes.func,
  }),
  setErrorNotification: PropTypes.func.isRequired,
  startTestRun: PropTypes.func.isRequired,
  status: PropTypes.string.isRequired,
};

TestRun.defaultProps = {
  test: {
    unsignedTransaction: null,
    params: {},
  },
};

export default TestRun;
