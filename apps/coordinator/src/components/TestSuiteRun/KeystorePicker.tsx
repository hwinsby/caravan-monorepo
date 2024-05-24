import React from "react";
import { useSelector, useDispatch } from "react-redux";

import {
  TREZOR,
  LEDGER,
  HERMIT,
  COLDCARD,
  PENDING,
  ACTIVE,
  INDIRECT_KEYSTORES,
  GetMetadata,
  KEYSTORE_TYPES,
} from "@caravan/wallets";

import {
  Box,
  Grid,
  FormControl,
  MenuItem,
  TextField,
  Button,
} from "@mui/material";
import {
  setKeystore as setKeystoreAction,
  setKeystoreStatus as setKeystoreStatusAction,
} from "../../actions/keystoreActions";
import { setErrorNotification as setErrorNotificationAction } from "../../actions/errorNotificationActions";
import { getKeystore } from "../../selectors/keystore";

import { KeystoreNote } from "./Note";
import InteractionMessages from "../InteractionMessages";

const NO_VERSION_DETECTION = ["", ...Object.values(INDIRECT_KEYSTORES)];

const KeystorePicker = () => {
  const type = useSelector(getKeystore).type;
  const status = useSelector(getKeystore).status;
  const version = useSelector(getKeystore).version;
  const dispatch = useDispatch();

  const detectVersion = async () => {
    dispatch(setKeystoreStatusAction(ACTIVE));
    try {
      const result = await interaction().run();
      if (result) {
        dispatch(setKeystoreAction(type, result.spec));
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      dispatch(setErrorNotificationAction(e.message));
    }
    dispatch(setKeystoreStatusAction(PENDING));
  };

  const interaction = () => {
    return GetMetadata({ keystore: type as KEYSTORE_TYPES });
  };

  const handleTypeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newType = event.target.value as KEYSTORE_TYPES | "";
    dispatch(setKeystoreAction(newType, version));
  };

  const handleVersionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newVersion = event.target.value;
    if (type) {
      dispatch(setKeystoreAction(type, newVersion));
    }
  };

  return (
    <Box>
      <Grid container spacing={2} justifyContent="center">
        <Grid item md={4}>
          <FormControl fullWidth>
            <TextField
              label="Type"
              id="keystore-select"
              value={type}
              onChange={handleTypeChange}
              select
              variant="standard"
            >
              <MenuItem value="">{"< Select type >"}</MenuItem>
              <MenuItem value={TREZOR}>Trezor</MenuItem>
              <MenuItem value={LEDGER}>Ledger</MenuItem>
              <MenuItem value={COLDCARD}>Coldcard</MenuItem>
              <MenuItem value={HERMIT}>Hermit</MenuItem>
            </TextField>
          </FormControl>
        </Grid>

        <Grid item md={6}>
          <TextField
            name="version"
            fullWidth
            label="Version"
            value={version}
            variant="standard"
            disabled={type === ""}
            onChange={handleVersionChange}
          />
        </Grid>

        <Grid item md={2}>
          <Button
            disabled={status === ACTIVE || NO_VERSION_DETECTION.includes(type)}
            onClick={detectVersion}
          >
            {status === ACTIVE ? "Detecting..." : "Detect"}
          </Button>
        </Grid>
      </Grid>

      {type && !NO_VERSION_DETECTION.includes(type) && (
        <InteractionMessages
          messages={interaction().messagesFor({ state: status })}
        />
      )}

      <KeystoreNote />
    </Box>
  );
};

export default KeystorePicker;
