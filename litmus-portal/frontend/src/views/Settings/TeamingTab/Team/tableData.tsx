import { useMutation, useQuery } from '@apollo/client';
import { Avatar, IconButton, TableCell, Typography } from '@material-ui/core';
import { ButtonFilled, ButtonOutlined, Modal } from 'litmus-ui';
import moment from 'moment';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Loader from '../../../../components/Loader';
import { GET_PROJECT, GET_USER, REMOVE_INVITATION } from '../../../../graphql';
import { MemberInvitation } from '../../../../models/graphql/invite';
import {
  CurrentUserDedtailsVars,
  CurrentUserDetails,
  Member,
} from '../../../../models/graphql/user';
import { CurrentUserData } from '../../../../models/userData';
import { getProjectID } from '../../../../utils/getSearchParams';
import { userInitials } from '../../../../utils/userInitials';
import useStyles from './styles';

interface TableDataProps {
  row: Member;
  index: number;
  showModal: () => void;
  handleOpen: () => void;
  open: boolean;
}
const TableData: React.FC<TableDataProps> = ({
  row,
  showModal,
  handleOpen,
  open,
}) => {
  const classes = useStyles();
  const projectID = getProjectID();

  const { t } = useTranslation();

  // Function to display date in format Do MMM,YYYY Hr:MM AM/PM
  const formatDate = (date: string) => {
    const day = moment(date).format('Do MMM, YYYY LT');
    return day;
  };

  // mutation to remove member
  const [removeMember, { loading }] = useMutation<MemberInvitation>(
    REMOVE_INVITATION,
    {
      onCompleted: () => {
        showModal();
      },
      onError: () => {},
      refetchQueries: [
        {
          query: GET_PROJECT,
          variables: { projectID },
        },
      ],
    }
  );

  const [memberDetails, setMemberDetails] = useState<CurrentUserData>();

  useQuery<CurrentUserDetails, CurrentUserDedtailsVars>(GET_USER, {
    variables: { username: row.user_name },
    onCompleted: (data) => {
      setMemberDetails({
        name: data.getUser.name,
        uid: data.getUser.id,
        username: data.getUser.username,
        role: data.getUser.role,
        email: data.getUser.email,
      });
    },
  });
  return (
    <>
      <TableCell className={classes.firstTC} component="th" scope="row">
        <div className={classes.firstCol}>
          <Avatar
            data-cy="avatar"
            alt="User"
            className={classes.avatarBackground}
          >
            {userInitials(memberDetails ? memberDetails.username : '')}
          </Avatar>
          {memberDetails ? memberDetails.username : ''}
        </div>
      </TableCell>
      <TableCell className={classes.otherTC}>{row.role}</TableCell>
      <TableCell className={classes.otherTC}>
        {memberDetails ? memberDetails.email : ''}
      </TableCell>
      <TableCell className={classes.otherTC}>
        <div className={classes.dateDiv}>
          <img
            className={classes.calIcon}
            src="./icons/calendarIcon.svg"
            alt="calendar"
          />
          {formatDate(row.joined_at)}
        </div>
      </TableCell>

      {row.role !== 'Owner' ? (
        <TableCell className={classes.otherTC} key={row.user_id}>
          <IconButton onClick={handleOpen}>
            <img alt="delete" src="./icons/deleteBin.svg" height="50" />
          </IconButton>
        </TableCell>
      ) : (
        <TableCell className={classes.otherTC} />
      )}
      <Modal
        data-cy="modal"
        open={open}
        width="43.75rem"
        disableBackdropClick
        disableEscapeKeyDown
        onClose={showModal}
        modalActions={
          <div className={classes.closeModal}>
            <IconButton onClick={showModal}>
              <img src="./icons/closeBtn.svg" alt="close" />
            </IconButton>
          </div>
        }
      >
        <div className={classes.body}>
          <img src="./icons/userDel.svg" alt="lock" />
          <div className={classes.text}>
            <Typography className={classes.typo} align="center">
              {t('settings.teamingTab.deleteUser.header')}
              <strong> {t('settings.teamingTab.deleteUser.text')}</strong>
            </Typography>
          </div>
          <div className={classes.textSecond}>
            <Typography className={classes.typoSub} align="center">
              <>{t('settings.teamingTab.deleteUser.body')}</>
            </Typography>
          </div>
          <div className={classes.buttonGroup}>
            <ButtonOutlined onClick={showModal}>
              <>{t('settings.teamingTab.deleteUser.noButton')}</>
            </ButtonOutlined>

            <div className={classes.yesButton}>
              <ButtonFilled
                disabled={loading}
                onClick={() => {
                  removeMember({
                    variables: {
                      data: {
                        project_id: projectID,
                        user_id: row.user_id,
                        role: row.role,
                      },
                    },
                  });
                }}
              >
                <>
                  {loading ? (
                    <div>
                      <Loader size={20} />
                    </div>
                  ) : (
                    <>{t('settings.teamingTab.deleteUser.yesButton')}</>
                  )}
                </>
              </ButtonFilled>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
};
export default TableData;
