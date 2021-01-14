import React from 'react';
import Navbar from 'components/navbar';
import ProjectList from 'components/projectlist';
import { User } from 'App';
import styles from 'App.less';

interface HomeProps {
    user: User;
};

export default class HomePage extends React.Component<HomeProps> {
    render() {
        return <>
            <Navbar user={this.props.user}></Navbar>
            <div className={styles.homepage}>
                <h1>Projects</h1>
                <ProjectList user={this.props.user} parent={[]} />
            </div>
        </>
    }
};