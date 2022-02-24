import React from 'react';

import { CSS } from '../../stitches.config';
import { Box, Checkbox, Text, TextFieldFund } from '../../ui';

import { IEpoch } from 'types';

//#region Interfaces & Types

export interface AllocateFundsCardProps {
  epoch: IEpoch;
  fundsAvailable: number;
  checkedValue: boolean;
  onChange(value: number): void;
  onCheckedChange(value: boolean, type: string): void;
  children?: React.ReactNode;
  css?: CSS;
  title?: string;
}

//#endregion Interfaces

//#region Organisms
export const AllocateFundsCard: React.FC<AllocateFundsCardProps> = ({
  epoch,
  ...props
}): JSX.Element => {
  // const [isRecurringFund, setIsRecurringFund] = React.useState<boolean>(false);

  const handleOnFundPeriod = (value: boolean) => {
    props.onCheckedChange(value, epoch.repeatEnum);
  };
  return (
    <Box
      css={{
        display: 'flex',
        flexDirection: 'column',
        gap: '$md',
        borderRadius: '$1',
        backgroundColor: 'white',
        alignItems: 'center',
        py: '$xl',
        ...props.css,
      }}
    >
      <Text
        css={{
          fontSize: '$5',
          color: '$text',
          fontWeight: '$light',
        }}
      >
        {props.title}
      </Text>
      <Text
        css={{
          fontSize: 'calc($9 - 2px)',
          color: '$text',
          fontWeight: '$bold',
          '@sm': {
            fontSize: '$8',
            textAlign: 'center',
          },
        }}
      >
        {epoch.labelGraph}
      </Text>
      <Text
        css={{
          fontSize: '$8',
          color: '$lightBlue',
          fontWeight: '$normal',
          mt: '$md',
          '@sm': {
            fontSize: '$7',
            textAlign: 'center',
          },
        }}
      >
        {epoch.labelDayRange}
      </Text>
      <Text
        css={{
          fontSize: '$4',
          color: '$text',
          fontWeight: '$light',
          '@sm': {
            fontSize: '$3',
            textAlign: 'center',
          },
        }}
      >
        (Repeats {epoch.repeatEnum})
      </Text>
      <Box
        css={{
          display: 'flex',
          flexDirection: 'column',
          gap: '$sm',
          mt: '$xl',
        }}
      >
        <TextFieldFund
          onChange={props.onChange}
          fundsAvailable={props.fundsAvailable}
        />
        <Box
          css={{
            display: 'flex',
            justifyContent: 'flex-end',
            width: '$full',
          }}
        >
          <Checkbox
            checked={props.checkedValue}
            onCheckedChange={handleOnFundPeriod}
            label={`Fund ${epoch.repeatEnum}`}
          />
        </Box>
      </Box>
      {props.children && (
        <Box
          css={{
            display: 'flex',
            mt: '$2xl',
          }}
        >
          {props.children}
        </Box>
      )}
    </Box>
  );
};
//#endregion

AllocateFundsCard.defaultProps = {
  title: 'Allocate to',
};
