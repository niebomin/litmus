import { Typography, useTheme } from '@material-ui/core';
import Paper from '@material-ui/core/Paper';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import { ToggleButton, ToggleButtonGroup } from '@material-ui/lab';
import localforage from 'localforage';
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import YAML from 'yaml';
import Row from '../../../containers/layouts/Row';
import { experimentMap } from '../../../models/redux/workflow';
import useActions from '../../../redux/actions';
import * as WorkflowActions from '../../../redux/actions/workflow';
import { RootState } from '../../../redux/reducers';
import parsed from '../../../utils/yamlUtils';
import ConfigurationStepper from './ConfigurationStepper/ConfigurationStepper';
import useStyles from './styles';

interface WorkflowTableProps {
  isCustom: boolean | undefined;
}

interface ChaosCRDTable {
  StepIndex: number;
  Name: string;
  Namespace: string;
  Application: string;
  Probes: number;
  ChaosEngine: string;
}

const WorkflowTable = forwardRef(({ isCustom }: WorkflowTableProps, ref) => {
  const classes = useStyles();
  const { t } = useTranslation();

  const theme = useTheme();
  const workflow = useActions(WorkflowActions);
  const [experiments, setExperiments] = useState<ChaosCRDTable[]>([]);
  const [revertChaos, setRevertChaos] = useState<boolean>(false);
  const [displayStepper, setDisplayStepper] = useState<boolean>(false);
  const [engineIndex, setEngineIndex] = useState<number>(0);
  const manifest = useSelector(
    (state: RootState) => state.workflowManifest.manifest
  );

  const addWeights = (manifest: string) => {
    const arr: experimentMap[] = [];
    const hashMap = new Map();
    const tests = parsed(manifest);
    tests.forEach((test) => {
      let value = 10;
      if (hashMap.has(test)) {
        value = hashMap.get(test);
      }
      arr.push({ experimentName: test, weight: value });
    });
    localforage.setItem('weights', arr);
  };

  const parsing = (yamlText: string) => {
    const parsedYaml = YAML.parse(yamlText);
    const expData: ChaosCRDTable[] = [];
    addWeights(manifest);
    parsedYaml.spec.templates.forEach((template: any, index: number) => {
      if (template.inputs && template.inputs.artifacts) {
        template.inputs.artifacts.forEach((artifact: any) => {
          const chaosEngine = YAML.parse(artifact.raw.data);
          if (chaosEngine.kind === 'ChaosEngine') {
            expData.push({
              StepIndex: index,
              Name: chaosEngine.metadata.name,
              Namespace: chaosEngine.spec.appinfo?.appns ?? '',
              Application: chaosEngine.spec.appinfo?.applabel ?? '',
              Probes: chaosEngine.spec.experiments[0].spec.probe?.length ?? 0,
              ChaosEngine: artifact.raw.data,
            });
          }
        });
      }
    });
    setExperiments(expData);
  };

  // Revert Chaos
  const toggleRevertChaos = (manifest: string) => {
    let deleteEngines = 'kubectl delete chaosengine ';
    const parsedYAML = YAML.parse(manifest);

    parsedYAML.spec.templates[0].steps.push([
      {
        name: 'revert-chaos',
        template: 'revert-chaos',
      },
    ]);

    parsed(manifest).forEach((_, i) => {
      deleteEngines = `${
        deleteEngines +
        YAML.parse(
          parsedYAML.spec.templates[2 + i].inputs.artifacts[0].raw.data
        ).metadata.name
      } `;
    });

    deleteEngines += '-n {{workflow.parameters.adminModeNamespace}}';

    parsedYAML.spec.templates[parsedYAML.spec.templates.length] = {
      name: 'revert-chaos',
      container: {
        image: 'litmuschaos/k8s:latest',
        command: ['sh', '-c'],
        args: [deleteEngines],
      },
    };

    workflow.setWorkflowManifest({
      manifest: YAML.stringify(parsedYAML),
    });
  };

  const closeConfigurationStepper = () => {
    workflow.setWorkflowManifest({
      engineYAML: '',
    });
    setDisplayStepper(false);
  };

  const handleChange = (
    event: React.MouseEvent<HTMLElement>,
    newValue: boolean
  ) => {
    setRevertChaos(newValue);
  };

  useEffect(() => {
    if (manifest.length) {
      parsing(manifest);
    }
  }, [manifest]);

  function onNext() {
    if (experiments.length === 0) {
      return false; // Should show alert
    }
    if (revertChaos === true) toggleRevertChaos(manifest);
    return true; // Should not show any alert
  }

  useImperativeHandle(ref, () => ({
    onNext,
  }));

  return (
    <div>
      {!displayStepper ? (
        <>
          <TableContainer className={classes.table} component={Paper}>
            <Table aria-label="simple table">
              <TableHead>
                <TableRow>
                  <TableCell>
                    {t('createWorkflow.chooseWorkflow.table.head1')}
                  </TableCell>
                  <TableCell align="left">
                    {t('createWorkflow.chooseWorkflow.table.head2')}
                  </TableCell>
                  <TableCell align="left">
                    {t('createWorkflow.chooseWorkflow.table.head3')}
                  </TableCell>
                  <TableCell align="left">
                    {t('createWorkflow.chooseWorkflow.table.head4')}
                  </TableCell>
                  <TableCell align="left">
                    {t('createWorkflow.chooseWorkflow.table.head5')}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {experiments.length > 0 ? (
                  experiments.map((experiment: ChaosCRDTable, index) => (
                    <TableRow key={experiment.Name}>
                      <TableCell component="th" scope="row">
                        {index + 1}
                      </TableCell>
                      <TableCell
                        onClick={() => {
                          setDisplayStepper(true);
                          setEngineIndex(experiment.StepIndex);
                          workflow.setWorkflowManifest({
                            engineYAML: experiment.ChaosEngine,
                          });
                        }}
                        align="left"
                        style={{ cursor: 'pointer' }}
                      >
                        {experiment.Name}
                      </TableCell>
                      <TableCell align="left">{experiment.Namespace}</TableCell>
                      <TableCell align="left">
                        {experiment.Application}
                      </TableCell>
                      <TableCell align="left">{experiment.Probes}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Typography align="center">
                        {t('createWorkflow.chooseWorkflow.pleaseAddExp')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          {isCustom && (
            <TableContainer className={classes.revertChaos} component={Paper}>
              <Row className={classes.wrapper}>
                <div className={classes.key}>
                  <Typography>
                    {t('createWorkflow.chooseWorkflow.revertSchedule')}
                  </Typography>
                </div>
                <div>
                  <ToggleButtonGroup
                    value={revertChaos}
                    exclusive
                    onChange={handleChange}
                    aria-label="text alignment"
                  >
                    <ToggleButton
                      value
                      style={{
                        backgroundColor: revertChaos
                          ? theme.palette.success.main
                          : theme.palette.disabledBackground,
                        color: revertChaos
                          ? theme.palette.common.white
                          : theme.palette.text.disabled,
                      }}
                      aria-label="centered"
                    >
                      {t('createWorkflow.chooseWorkflow.trueValue')}
                    </ToggleButton>
                    <ToggleButton
                      value={false}
                      style={{
                        backgroundColor: !revertChaos
                          ? theme.palette.error.main
                          : theme.palette.disabledBackground,
                        color: !revertChaos
                          ? theme.palette.common.white
                          : theme.palette.text.disabled,
                      }}
                      aria-label="centered"
                    >
                      {t('createWorkflow.chooseWorkflow.falseValue')}
                    </ToggleButton>
                  </ToggleButtonGroup>
                </div>
              </Row>
            </TableContainer>
          )}
        </>
      ) : (
        <ConfigurationStepper
          experimentIndex={engineIndex}
          closeStepper={closeConfigurationStepper}
          isCustom={isCustom}
        />
      )}
    </div>
  );
});

export default WorkflowTable;
