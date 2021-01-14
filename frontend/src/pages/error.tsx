import React from 'react';
import { FailResponses } from 'utils/xhr';

export default class Error extends React.Component<{error: FailResponses}> {
    render() {
        const error = this.props.error;
        if (error.type === "bad") {
            return <h2>Server sent malformed response: {error.error.toString()}</h2>;
        } else if (error.type === "error") {
            return <h2>Client failure: {error.error.toString()}</h2>
        } else {
            return <><h2>{error.code + ": " + error.message}</h2><h5>{error.result}</h5></>
        }
    }
}