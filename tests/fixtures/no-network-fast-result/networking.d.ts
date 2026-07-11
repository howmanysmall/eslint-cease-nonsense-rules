declare module "@flamework/networking" {
	export namespace Networking {
		function createFunction<ClientToServer, ServerToClient>(
			clientToServer?: ClientToServer,
			serverToClient?: ServerToClient,
		): {
			readonly clientToServer?: ClientToServer;
			readonly serverToClient?: ServerToClient;
		};
	}
}
