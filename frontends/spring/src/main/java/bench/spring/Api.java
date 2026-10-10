package bench.spring;

import java.net.http.HttpClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * Server-side API client. No caching: every call hits the API. One shared JDK HttpClient underneath, which keeps
 * HTTP/1.1 connections alive and reuses them (like Node's fetch/undici in the JS variants).
 */
@Component
public class Api {

	private final RestClient http;

	public Api(@Value("${app.backend-url}") String backendUrl) {
		// Spring Boot 4 only auto-configures a RestClient.Builder with the spring-boot-restclient module (not part of
		// a Spring Web + Thymeleaf app), so the client is built directly; RestClient.builder() still registers the
		// Jackson 3 message converters found on the classpath.
		// HTTP/1.1 like the Node variants; the JDK client's default (HTTP_2) would add an h2c Upgrade attempt.
		HttpClient client = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build();
		this.http = RestClient.builder().baseUrl(backendUrl).requestFactory(new JdkClientHttpRequestFactory(client)).build();
	}

	public java.util.List<Post> feed() {
		Post.Feed feed = http.get().uri("/feed").retrieve().body(Post.Feed.class);
		return feed.posts();
	}

	/** The post, or null when the API says 404 (missing) or 400 (invalid id). */
	public Post post(String id) {
		return http.get().uri("/posts/{id}", id).exchange((req, res) -> {
			HttpStatusCode status = res.getStatusCode();
			if (status.value() == 404 || status.value() == 400) return null;
			if (status.value() != 200) throw new IllegalStateException("post: backend returned " + status.value());
			Post.One one = res.bodyTo(Post.One.class);
			return one == null ? null : one.post();
		});
	}

	/** POST /posts with {"body": ...}; returns the API's status and raw JSON body. */
	public ResponseEntity<byte[]> createPost(String authorization, byte[] json) {
		return passthrough(http.post().uri("/posts").contentType(MediaType.APPLICATION_JSON).body(json), authorization);
	}

	/** POST /posts/:id/like; returns the API's status and raw JSON body. */
	public ResponseEntity<byte[]> likePost(String authorization, String id) {
		return passthrough(http.post().uri("/posts/{id}/like", id), authorization);
	}

	private static ResponseEntity<byte[]> passthrough(RestClient.RequestHeadersSpec<?> spec, String authorization) {
		if (authorization != null) spec = spec.header(HttpHeaders.AUTHORIZATION, authorization);
		return spec.exchange((req, res) -> ResponseEntity.status(res.getStatusCode())
				.contentType(MediaType.APPLICATION_JSON)
				.body(res.getBody().readAllBytes()));
	}
}
