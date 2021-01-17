import React from 'react';
import styles from './index.less';

interface RowInputProps {
    type: "text" | "email" | "number" | "password" | "search" | "url" | "tel";
};

export default class RowInput extends React.Component<React.HTMLProps<HTMLInputElement> & RowInputProps> {
    render() {
        const {children, type, ...props} = this.props;
        return <label className={styles.row}>
            <div className={styles.label}>{children}</div>
            <input {...props} type={type} className={styles.input} />
        </label>;
    }
}