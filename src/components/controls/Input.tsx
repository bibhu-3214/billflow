import { type TextFieldProps, TextField } from '../ui/primitives';

import React from 'react';

export default function Input(props: Omit<TextFieldProps, 'error'> & { error?: string | null }) {
   const { name, label, value, error = null, onChange, ...other } = props;
   return (
      <TextField
         variant="outlined"
         label={label}
         name={name}
         value={value}
         onChange={onChange}
         {...other}
         {...(error && { error: true, helperText: error })}
      />
   );
}
