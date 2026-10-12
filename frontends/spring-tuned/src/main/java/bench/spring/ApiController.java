package bench.spring;

import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * JSON passthrough for the load test's writes: forwards the incoming Authorization header as-is (or none) and returns
 * the API's status and JSON body unchanged. No origin check here, like the other variants.
 */
@RestController
public class ApiController {

	private static final byte[] MALFORMED = "{\"error\":\"malformed JSON body\"}".getBytes();

	private final Api api;
	private final JsonMapper json;

	public ApiController(Api api, JsonMapper json) {
		this.api = api;
		this.json = json;
	}

	@PostMapping("/api/posts")
	public ResponseEntity<byte[]> create(@RequestHeader(name = HttpHeaders.AUTHORIZATION, required = false) String authorization,
			@RequestBody(required = false) byte[] raw) {
		JsonNode root;
		try {
			// Strict parse of the whole body (an empty body or trailing garbage is malformed, like JSON.parse).
			root = raw == null || raw.length == 0 ? null : json.readTree(raw);
		} catch (JacksonException e) {
			root = null;
		}
		if (root == null || root.isMissingNode() || root.isNull()) {
			return ResponseEntity.badRequest().contentType(MediaType.APPLICATION_JSON).body(MALFORMED);
		}
		// String(json.body ?? "") in the JS variants.
		JsonNode b = root.get("body");
		String body = b == null || b.isNull() ? "" : b.isValueNode() ? b.asString() : b.toString();
		return api.createPost(authorization, json.writeValueAsBytes(Map.of("body", body)));
	}

	@PostMapping("/api/posts/{id}/like")
	public ResponseEntity<byte[]> like(@RequestHeader(name = HttpHeaders.AUTHORIZATION, required = false) String authorization,
			@PathVariable String id) {
		return api.likePost(authorization, id);
	}
}
