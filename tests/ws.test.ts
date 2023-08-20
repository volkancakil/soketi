import { Server } from './../src/server';
import { Utils } from './utils';

jest.retryTimes(parseInt(process.env.RETRY_TIMES || '1'));

describe('ws test', () => {
    beforeEach(() => {
        jest.resetModules();

        return Utils.waitForPortsToFreeUp();
    });

    afterEach(() => {
        return Utils.flushServers();
    });

    Utils.shouldRun(Utils.appManagerIs('array'))('client events', done => {
        Utils.newServer({ 'appManager.array.apps.0.enableClientMessages': true }, (server: Server) => {
            let client1 = Utils.newClientForPrivateChannel();
            let client2;
            let channelName = `private-${Utils.randomChannelName()}`;

            client1.connection.bind('connected', () => {
                client1.connection.bind('message', ({ event, channel, data }) => {
                    if (event === 'client-greeting' && channel === channelName) {
                        expect(data.message).toBe('hello');
                        client1.disconnect();
                        client2.disconnect();
                        done();
                    }
                });

                let channel = client1.subscribe(channelName);

                channel.bind('pusher:subscription_succeeded', () => {
                    client2 = Utils.newClientForPrivateChannel();

                    client2.connection.bind('connected', () => {
                        let channel = client2.subscribe(channelName);

                        channel.bind('pusher:subscription_succeeded', () => {
                            channel.trigger('client-greeting', {
                                message: 'hello',
                            });
                        });
                    });
                });
            });
        });
    });

    Utils.shouldRun(Utils.appManagerIs('array') && !Utils.adapterIs('nats'))('client events for presence channels', done => {
        Utils.newServer({ 'appManager.array.apps.0.enableClientMessages': true }, (server: Server) => {
            let user1 = {
                user_id: 1,
                user_info: {
                    id: 1,
                    name: 'John',
                },
            };

            let user2 = {
                user_id: 2,
                user_info: {
                    id: 2,
                    name: 'Alice',
                },
            };

            let client1 = Utils.newClientForPresenceUser(user1);
            let channelName = `presence-${Utils.randomChannelName()}`;

            client1.connection.bind('connected', () => {
                let client2 = Utils.newClientForPresenceUser(user2);

                let channel = client1.subscribe(channelName);

                channel.bind('client-greeting', (data, metadata) => {
                    expect(data.message).toBe('hello');
                    expect(metadata.user_id).toBe(2);
                    client1.disconnect();
                    client2.disconnect();
                    done();
                });

                channel.bind('pusher:subscription_succeeded', () => {
                    client2.connection.bind('connected', () => {
                        let channel = client2.subscribe(channelName);

                        channel.bind('pusher:subscription_succeeded', () => {
                            channel.trigger('client-greeting', { message: 'hello' });
                        });
                    });
                });
            });
        });
    }, 60_000);

    Utils.shouldRun(Utils.appManagerIs('array'))('client events dont get emitted when client messaging is disabled', done => {
        Utils.newServer({ 'appManager.array.apps.0.enableClientMessages': false }, (server: Server) => {
            let client1 = Utils.newClientForPrivateChannel();
            let channelName = `private-${Utils.randomChannelName()}`;

            client1.connection.bind('connected', () => {
                client1.connection.bind('message', ({ event, channel, data }) => {
                    if (event === 'client-greeting' && channel === channelName) {
                        throw new Error('The message was actually sent.');
                    }
                });

                let channel = client1.subscribe(channelName);

                channel.bind('pusher:subscription_succeeded', () => {
                    let client2 = Utils.newClientForPrivateChannel();

                    client2.connection.bind('connected', () => {
                        let channel = client2.subscribe(channelName);

                        channel.bind('pusher:subscription_succeeded', () => {
                            channel.bind('pusher:error', (error) => {
                                expect(error.code).toBe(4301);
                                client1.disconnect();
                                client2.disconnect();
                                done();
                            });

                            channel.trigger('client-greeting', {
                                message: 'hello',
                            });
                        });
                    });
                });
            });
        });
    });

    Utils.shouldRun(Utils.appManagerIs('array'))('client events dont get emitted when event name is big', done => {
        Utils.newServer({ 'appManager.array.apps.0.enableClientMessages': true, 'eventLimits.maxNameLength': 25 }, (server: Server) => {
            let client1 = Utils.newClientForPrivateChannel();
            let channelName = `private-${Utils.randomChannelName()}`;
            let eventName = 'client-a8hsuNFXUhfStiWE02R'; // 26 characters

            client1.connection.bind('connected', () => {
                client1.connection.bind('message', ({ event, channel, data }) => {
                    if (event === eventName && channel === channelName) {
                        throw new Error('The message was actually sent.');
                    }
                });

                let channel = client1.subscribe(channelName);

                channel.bind('pusher:subscription_succeeded', () => {
                    let client2 = Utils.newClientForPrivateChannel();

                    client2.connection.bind('connected', () => {
                        let channel = client2.subscribe(channelName);

                        channel.bind('pusher:subscription_succeeded', () => {
                            channel.bind('pusher:error', (error) => {
                                expect(error.code).toBe(4301);
                                client1.disconnect();
                                client2.disconnect();
                                done();
                            });

                            channel.trigger(eventName, {
                                message: 'hello',
                            });
                        });
                    });
                });
            });
        });
    });

    Utils.shouldRun(Utils.appManagerIs('array'))('client events dont get emitted when event payload is big', done => {
        Utils.newServer({ 'appManager.array.apps.0.enableClientMessages': true, 'eventLimits.maxPayloadInKb': 1/1024/1024 }, (server: Server) => {
            let client1 = Utils.newClientForPrivateChannel();
            let channelName = `private-${Utils.randomChannelName()}`;

            client1.connection.bind('connected', () => {
                client1.connection.bind('message', ({ event, channel, data }) => {
                    if (event === 'client-greeting' && channel === channelName) {
                        throw new Error('The message was actually sent.');
                    }
                });

                let channel = client1.subscribe(channelName);

                channel.bind('pusher:subscription_succeeded', () => {
                    let client2 = Utils.newClientForPrivateChannel({});

                    client2.connection.bind('connected', () => {
                        let channel = client2.subscribe(channelName);

                        channel.bind('pusher:subscription_succeeded', () => {
                            channel.bind('pusher:error', (error) => {
                                expect(error.code).toBe(4301);
                                client1.disconnect();
                                client2.disconnect();
                                done();
                            });

                            channel.trigger('client-greeting', {
                                message: 'hello',
                            });
                        });
                    });
                });
            });
        });
    });

    test('cannot connect using invalid app key', done => {
        Utils.newServer({}, (server: Server) => {
            let client = Utils.newClient({}, 6001, 'invalid-key', false);

            client.connection.bind('error', ({ error }) => {
                if (error && error.data.code === 4001) {
                    client.disconnect();
                    done();
                }
            });
        });
    });

    Utils.shouldRun(Utils.appManagerIs('array'))('throw over quota error if reached connection limit', done => {
        Utils.newServer({ 'appManager.array.apps.0.maxConnections': 1 }, (server: Server) => {
            let client1 = Utils.newClient({}, 6001, 'app-key', false);

            client1.connection.bind('connected', () => {
                let client2 = Utils.newClient({}, 6001, 'app-key', false);

                client2.connection.bind('error', ({ error }) => {
                    if (error && error.data.code === 4004) {
                        client1.disconnect();
                        client2.disconnect();
                        done();
                    }
                });
            });
        });
    });

    Utils.shouldRun(Utils.appManagerIs('array'))('throw invalid app error if app is deactivated', done => {
        Utils.newServer({ 'appManager.array.apps.0.enabled': false }, (server: Server) => {
            let client = Utils.newClient();

            client.connection.bind('error', ({ error }) => {
                if (error && error.data.code === 4003) {
                    client.disconnect();
                    done();
                }
            });
        });
    });

    test('should check for channelLimits.maxNameLength', done => {
        Utils.newServer({ 'channelLimits.maxNameLength': 25 }, (server: Server) => {
            let client = Utils.newClient();

            client.connection.bind('connected', () => {
                let channelName = 'a8hsuNFXUhfS1zoyvtDtiWE02Ra'; // 26 characters

                client.subscribe(channelName);

                client.connection.bind('message', ({ event, channel, data }) => {
                    if (event === 'pusher:subscription_error' && channel === channelName) {
                        expect(data.type).toBe('LimitReached');
                        expect(data.status).toBe(4009);
                        expect(data.error).toBeDefined();
                        client.disconnect();
                        done();
                    }
                });
            });
        });
    });

    test('should check for presence.maxMemberSizeInKb', done => {
        Utils.newServer({ 'presence.maxMemberSizeInKb': 1/1024/1024 }, (server: Server) => {
            let user = {
                user_id: 1,
                user_info: {
                    id: 1,
                    name: 'John',
                },
            };

            let client = Utils.newClientForPresenceUser(user);
            let channelName = `presence-${Utils.randomChannelName()}`;

            client.connection.bind('connected', () => {
                client.subscribe(channelName);

                client.connection.bind('message', ({ event, channel, data }) => {
                    if (event === 'pusher:subscription_error' && channel === channelName) {
                        expect(data.type).toBe('LimitReached');
                        expect(data.status).toBe(4301);
                        expect(data.error).toBeDefined();
                        client.disconnect();
                        done();
                    }
                });
            });
        });
    });

    test('should check for presence.maxMembersPerChannel', done => {
        Utils.newServer({ 'presence.maxMembersPerChannel': 1 }, (server: Server) => {
            let user1 = {
                user_id: 1,
                user_info: {
                    id: 1,
                    name: 'John',
                },
            };

            let user2 = {
                user_id: 2,
                user_info: {
                    id: 2,
                    name: 'Alice',
                },
            };

            let client1 = Utils.newClientForPresenceUser(user1);
            let client2 = Utils.newClientForPresenceUser(user2);
            let channelName = `presence-${Utils.randomChannelName()}`;

            client1.connection.bind('connected', () => {
                let channel1 = client1.subscribe(channelName);

                channel1.bind('pusher:subscription_succeeded', () => {
                    client2.connection.bind('message', ({ event, channel, data }) => {
                        if (event === 'pusher:subscription_error' && channel === channelName) {
                            expect(data.type).toBe('LimitReached');
                            expect(data.status).toBe(4004);
                            expect(data.error).toBeDefined();
                            client1.disconnect();
                            client2.disconnect();
                            done();
                        }
                    });

                    client2.subscribe(channelName);
                });
            });
        });
    });

    test('adapter getSockets works', done => {
        Utils.newServer({}, (server: Server) => {
            let client1 = Utils.newClient();

            client1.connection.bind('connected', () => {
                server.adapter.getSockets('app-id').then(sockets => {
                    expect(sockets.size).toBe(1);

                    let client2 = Utils.newClient();

                    client2.connection.bind('connected', () => {
                        server.adapter.getSockets('app-id').then(sockets => {
                            expect(sockets.size).toBe(2);
                            client1.disconnect();
                            client2.disconnect();
                            done();
                        });
                    });
                })
            });
        });
    });

    test('adapter getChannelSockets works', done => {
        Utils.newServer({}, (server: Server) => {
            let client1 = Utils.newClient();
            let channelName = Utils.randomChannelName();

            client1.connection.bind('connected', () => {
                server.adapter.getChannelSockets('app-id', channelName).then(sockets => {
                    expect(sockets.size).toBe(0);

                    let client1 = Utils.newClient();
                    let channel1 = client1.subscribe(channelName);

                    channel1.bind('pusher:subscription_succeeded', () => {
                        server.adapter.getChannelSockets('app-id', channelName).then(sockets => {
                            expect(sockets.size).toBe(1);

                            let client2 = Utils.newClient();

                            client2.connection.bind('connected', () => {
                                let channel2 = client2.subscribe(channelName);

                                channel2.bind('pusher:subscription_succeeded', () => {
                                    server.adapter.getChannelSockets('app-id', channelName).then(sockets => {
                                        expect(sockets.size).toBe(2);

                                        client2.unsubscribe(channelName);

                                        Utils.wait(3000).then(() => {
                                            server.adapter.getChannelSockets('app-id', channelName).then(sockets => {
                                                expect(sockets.size).toBe(1);
                                                client1.disconnect();
                                                client2.disconnect();
                                                done();
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });

    Utils.shouldRun(Utils.appManagerIs('array'))('signin after connection', done => {
        Utils.newServer({ 'appManager.array.apps.0.enableUserAuthentication': true, 'userAuthenticationTimeout': 5_000 }, (server: Server) => {
            let client = Utils.newClientForPrivateChannel({}, 6001, 'app-key', { id: 1 });

            client.connection.bind('connected', () => {
                client.connection.bind('message', ({ event }) => {
                    if (event === 'pusher:signin_success') {
                        // After subscription, wait 10 seconds to make sure it isn't disconnected
                        setTimeout(() => {
                            client.disconnect();
                            done();
                        }, 10_000);
                    }
                });

                client.signin();
            });
        });
    });

    Utils.shouldRun(Utils.appManagerIs('array'))('not calling signin after connection throws right error code', done => {
        Utils.newServer({ 'appManager.array.apps.0.enableUserAuthentication': true, 'userAuthenticationTimeout': 5_000 }, (server: Server) => {
            let client = Utils.newClientForPrivateChannel({}, 6001, 'app-key', { id: 1 });

            client.connection.bind('connected', () => {
                client.connection.bind('message', (error) => {
                    if (error.event === 'pusher:error') {
                        expect(error.data.code).toBe(4009);
                        client.disconnect();
                        done();
                    }
                });
            });
        });
    });

    Utils.shouldRun(Utils.appManagerIs('array'))('not having user id throws an error', done => {
        Utils.newServer({ 'appManager.array.apps.0.enableUserAuthentication': true, 'userAuthenticationTimeout': 5_000 }, (server: Server) => {
            let client = Utils.newClientForPrivateChannel({}, 6001, 'app-key', { name: 'John' });

            client.connection.bind('connected', () => {
                client.connection.bind('message', (error) => {
                    if (error.event === 'pusher:error') {
                        expect(error.data.code).toBe(4009);
                        client.disconnect();
                        done();
                    }
                });
            });
        });
    });

    Utils.shouldRun(Utils.appManagerIs('array'))('sending wrong user data token throws error', done => {
        Utils.newServer({ 'appManager.array.apps.0.enableUserAuthentication': true, 'userAuthenticationTimeout': 5_000 }, (server: Server) => {
            let client = Utils.newClientForPrivateChannel({
                userAuthentication: {
                    customHandler: ({ socketId }, callback) => {
                        callback(false, {
                            auth: 'fail-on-purpose',
                            user_data: JSON.stringify({ id: 1 }),
                        });
                    },
                },
            }, 6001, 'app-key', { id: 1 });

            client.connection.bind('connected', () => {
                client.connection.bind('message', (error) => {
                    if (error.event === 'pusher:error') {
                        expect(error.data.code).toBe(4009);
                        client.disconnect();
                        done();
                    }
                });
            });
        });
    });
});
