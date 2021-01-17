import React from 'react';
import styles from './index.less';

export default class FormSubmit extends React.Component<React.ButtonHTMLAttributes<HTMLButtonElement>> {
    render() {
        const {children, className, ...props} = this.props;
        return <button {...props} className={(className || "") + " " + styles.submit}>{children}</button>;
    }
}