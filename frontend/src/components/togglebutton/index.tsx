import React from 'react';
import styles from './index.less';

interface ToggleButtonProps {
    checked: boolean | "mixed";
    disabled?: boolean;
    onToggle?: (newVal: boolean) => void;
}

export default class ToggleButton extends React.Component<ToggleButtonProps> {
    render() {
        const toggle = this.props.onToggle;
        const toggler = this.props.disabled == true || toggle == null ? () => null : () => toggle(!this.props.checked);
        return <div role="checkbox" tabIndex={0} aria-checked={this.props.checked} aria-disabled={this.props.disabled} className={styles.togglebutton} onClick={toggler} {...this.props.checked === true ? {"data-enabled": true} : {}} {...{"disabled": this.props.disabled}}>
            <div className={styles.background + " " + styles.enabled}></div>
            <div className={styles.background + " " + styles.disabled}></div>
            <div className={styles.button}></div>
        </div>
    }
}