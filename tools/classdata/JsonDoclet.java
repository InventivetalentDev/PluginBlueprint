import com.sun.source.doctree.DocCommentTree;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.stream.Collectors;
import javax.lang.model.SourceVersion;
import javax.lang.model.element.*;
import javax.lang.model.type.*;
import javax.tools.Diagnostic;
import jdk.javadoc.doclet.*;

public class JsonDoclet implements Doclet {
    private static final Set<String> JAVA_PACKAGES = Set.of(
        "java.io", "java.lang", "java.math", "java.net", "java.nio.charset", "java.nio.file", "java.text",
        "java.time", "java.time.format", "java.time.temporal", "java.util", "java.util.concurrent",
        "java.util.concurrent.atomic", "java.util.function", "java.util.regex", "java.util.stream");
    private DocletEnvironment environment;
    private Reporter reporter;
    private String outfile;
    private String meta;
    private final SortedMap<String, TypeElement> classes = new TreeMap<>();

    public void init(Locale locale, Reporter reporter) { this.reporter = reporter; }
    public String getName() { return "JsonDoclet"; }
    public SourceVersion getSupportedSourceVersion() { return SourceVersion.latest(); }

    public Set<Option> getSupportedOptions() {
        return Set.of(option("-outfile"), option("-meta"));
    }

    private Option option(String name) {
        return new Option() {
            public int getArgumentCount() { return 1; }
            public String getDescription() { return name.equals("-outfile") ? "Output JSON path" : "Metadata JSON"; }
            public Kind getKind() { return Kind.OTHER; }
            public List<String> getNames() { return List.of(name); }
            public String getParameters() { return "<value>"; }
            public boolean process(String option, List<String> arguments) {
                if (name.equals("-outfile")) outfile = arguments.getFirst();
                else meta = arguments.getFirst();
                return true;
            }
        };
    }

    public boolean run(DocletEnvironment environment) {
        this.environment = environment;
        if (outfile == null || meta == null) {
            reporter.print(Diagnostic.Kind.ERROR, "-outfile and -meta are required");
            return false;
        }
        for (Element element : environment.getIncludedElements()) collect(element);
        try (var writer = Files.newBufferedWriter(Path.of(outfile), StandardCharsets.UTF_8)) {
            writer.write("{\"meta\":" + meta + ",\"size\":" + classes.size() + ",\"classes\":[\n");
            boolean first = true;
            for (TypeElement type : classes.values()) {
                if (!first) writer.write(",\n");
                writer.write(json(classData(type)));
                first = false;
            }
            writer.write("\n]}\n");
            return true;
        } catch (IOException error) {
            reporter.print(Diagnostic.Kind.ERROR, error.getMessage());
            return false;
        }
    }

    private void collect(Element element) {
        if (element instanceof TypeElement type && type.getModifiers().contains(Modifier.PUBLIC)) {
            if (environment.getElementUtils().getModuleOf(type).getQualifiedName().contentEquals("java.base")
                && !JAVA_PACKAGES.contains(environment.getElementUtils().getPackageOf(type).getQualifiedName().toString())) return;
            Element parent = type.getEnclosingElement();
            if (parent instanceof TypeElement enclosing && !enclosing.getModifiers().contains(Modifier.PUBLIC)) return;
            classes.put(type.getQualifiedName().toString(), type);
            for (Element child : type.getEnclosedElements()) collect(child);
        }
    }

    private boolean visible(Element element) {
        return element.getModifiers().contains(Modifier.PUBLIC) || element.getModifiers().contains(Modifier.PROTECTED);
    }

    private String name(TypeElement type) {
        String pkg = environment.getElementUtils().getPackageOf(type).getQualifiedName().toString();
        return type.getQualifiedName().toString().substring(pkg.isEmpty() ? 0 : pkg.length() + 1);
    }

    private Map<String, Object> common(Element element) {
        var result = new LinkedHashMap<String, Object>();
        ElementKind kind = element.getKind();
        result.put("name", element instanceof TypeElement type ? name(type) :
            kind == ElementKind.CONSTRUCTOR ? element.getEnclosingElement().getSimpleName().toString() : element.getSimpleName().toString());
        DocCommentTree comment = environment.getDocTrees().getDocCommentTree(element);
        result.put("comment", comment == null ? "" : comment.getFullBody().stream().map(Object::toString).collect(Collectors.joining()));
        result.put("isClass", element instanceof TypeElement && !kind.isInterface());
        result.put("isInterface", kind.isInterface());
        result.put("isEnum", kind == ElementKind.ENUM);
        result.put("isEnumConstant", kind == ElementKind.ENUM_CONSTANT);
        result.put("isConstructor", kind == ElementKind.CONSTRUCTOR);
        result.put("isField", kind == ElementKind.FIELD);
        result.put("isMethod", kind == ElementKind.METHOD);
        result.put("isOrdinaryClass", kind == ElementKind.CLASS || kind == ElementKind.RECORD);
        result.put("isDeprecated", element.getAnnotationMirrors().stream().anyMatch(annotation ->
            ((TypeElement) annotation.getAnnotationType().asElement()).getQualifiedName().contentEquals("java.lang.Deprecated")));
        return result;
    }

    private Map<String, Object> classData(TypeElement type) {
        var result = common(type);
        result.putAll(typeData(type.asType()));
        result.put("package", environment.getElementUtils().getPackageOf(type).getQualifiedName().toString());
        result.put("superclass", type.getSuperclass().getKind() == TypeKind.NONE ? null : rawName(type.getSuperclass(), false));
        result.put("interfaces", type.getInterfaces().stream().map(t -> rawName(t, false)).toList());
        result.put("isAbstract", type.getModifiers().contains(Modifier.ABSTRACT));
        result.put("isStatic", type.getModifiers().contains(Modifier.STATIC));
        result.put("innerClasses", type.getEnclosedElements().stream().filter(e -> e instanceof TypeElement && visible(e))
            .map(e -> ((TypeElement) e).getQualifiedName().toString()).sorted().toList());
        result.put("isInnerClass", type.getEnclosingElement() instanceof TypeElement);
        var constructors = new ArrayList<ExecutableElement>();
        var methods = new ArrayList<ExecutableElement>();
        var fields = new ArrayList<VariableElement>();
        var constants = new ArrayList<String>();
        for (Element member : type.getEnclosedElements()) {
            if (!visible(member)) continue;
            switch (member.getKind()) {
                case CONSTRUCTOR -> constructors.add((ExecutableElement) member);
                case METHOD -> methods.add((ExecutableElement) member);
                case FIELD -> fields.add((VariableElement) member);
                case ENUM_CONSTANT -> constants.add(member.getSimpleName().toString());
                default -> { }
            }
        }
        constructors.sort(Comparator.comparing(e -> signature(e, false)));
        methods.sort(Comparator.comparing((ExecutableElement e) -> e.getSimpleName().toString()).thenComparing(e -> signature(e, false)));
        fields.sort(Comparator.comparing(e -> e.getSimpleName().toString()));
        result.put("constructors", constructors.stream().map(this::executableData).toList());
        result.put("methods", methods.stream().map(this::executableData).toList());
        result.put("fields", fields.stream().map(this::fieldData).toList());
        result.put("typeParameters", type.getTypeParameters().stream().map(this::variableData).toList());
        var subClasses = new ArrayList<String>();
        var subInterfaces = new ArrayList<String>();
        for (TypeElement child : classes.values()) {
            if (child.getSuperclass().getKind() != TypeKind.NONE && rawName(child.getSuperclass(), false).equals(type.getQualifiedName().toString())) {
                subClasses.add(child.getQualifiedName().toString());
            }
            // The legacy schema puts both implementors and extending interfaces here.
            if (child.getInterfaces().stream().anyMatch(t -> rawName(t, false).equals(type.getQualifiedName().toString()))) {
                subInterfaces.add(child.getQualifiedName().toString());
            }
        }
        result.put("subClasses", subClasses);
        result.put("subInterfaces", subInterfaces);
        result.put("enumConstants", constants);
        return result;
    }

    private Map<String, Object> executableData(ExecutableElement method) {
        var result = common(method);
        result.put("signature", signature(method, false));
        result.put("flatSignature", signature(method, true));
        result.put("isStatic", method.getModifiers().contains(Modifier.STATIC));
        result.put("isAbstract", method.getModifiers().contains(Modifier.ABSTRACT));
        result.put("isDefault", method.isDefault());
        result.put("parameters", method.getParameters().stream().map(p -> Map.of("name", p.getSimpleName().toString(), "type", typeData(p.asType()))).toList());
        if (method.getKind() == ElementKind.METHOD) result.put("returnType", typeData(method.getReturnType()));
        result.put("typeParameters", method.getTypeParameters().stream().map(this::variableData).toList());
        return result;
    }

    private Map<String, Object> fieldData(VariableElement field) {
        var result = common(field);
        result.put("type", typeData(field.asType()));
        result.put("isStatic", field.getModifiers().contains(Modifier.STATIC));
        if (field.getConstantValue() != null) result.put("constantValue", environment.getElementUtils().getConstantExpression(field.getConstantValue()));
        return result;
    }

    private Map<String, Object> variableData(TypeParameterElement variable) {
        return Map.of("name", variable.getSimpleName().toString(), "bounds", variable.getBounds().stream()
            .filter(t -> !rawName(t, false).equals("java.lang.Object")).map(t -> format(t, false)).toList());
    }

    private Map<String, Object> typeData(TypeMirror mirror) {
        TypeMirror base = mirror;
        String dimension = "";
        while (base instanceof ArrayType array) {
            dimension += "[]";
            base = array.getComponentType();
        }
        var result = new LinkedHashMap<String, Object>();
        result.put("isPrimitive", base.getKind().isPrimitive() || base.getKind() == TypeKind.VOID);
        result.put("simpleName", base instanceof DeclaredType declared ? declared.asElement().getSimpleName().toString() : rawName(base, true));
        result.put("qualifiedName", rawName(base, false));
        result.put("dimension", dimension);
        result.put("elementType", mirror instanceof ArrayType array ? typeData(array.getComponentType()) : Map.of());
        if (base instanceof TypeVariable variable) result.put("typeVariable", variableData((TypeParameterElement) variable.asElement()));
        return result;
    }

    private String signature(ExecutableElement method, boolean flat) {
        var parameters = new ArrayList<String>();
        for (VariableElement parameter : method.getParameters()) parameters.add(format(parameter.asType(), flat));
        if (method.isVarArgs()) {
            int last = parameters.size() - 1;
            String value = parameters.get(last);
            parameters.set(last, value.substring(0, value.length() - 2) + "...");
        }
        return "(" + String.join(", ", parameters) + ")";
    }

    private String rawName(TypeMirror mirror, boolean flat) {
        if (mirror instanceof DeclaredType declared) {
            var type = (TypeElement) declared.asElement();
            return flat ? name(type) : type.getQualifiedName().toString();
        }
        if (mirror instanceof TypeVariable variable) return variable.asElement().getSimpleName().toString();
        if (mirror.getKind().isPrimitive() || mirror.getKind() == TypeKind.VOID) return mirror.getKind().name().toLowerCase(Locale.ROOT);
        return format(mirror, flat);
    }

    private String format(TypeMirror mirror, boolean flat) {
        if (mirror instanceof ArrayType array) return format(array.getComponentType(), flat) + "[]";
        if (mirror instanceof DeclaredType declared) {
            String result = rawName(mirror, flat);
            if (!declared.getTypeArguments().isEmpty()) result += "<" + declared.getTypeArguments().stream()
                .map(t -> format(t, flat)).collect(Collectors.joining(", ")) + ">";
            return result;
        }
        if (mirror instanceof WildcardType wildcard) {
            if (wildcard.getExtendsBound() != null) return "? extends " + format(wildcard.getExtendsBound(), flat);
            if (wildcard.getSuperBound() != null) return "? super " + format(wildcard.getSuperBound(), flat);
            return "?";
        }
        if (mirror instanceof IntersectionType intersection) return intersection.getBounds().stream().map(t -> format(t, flat)).collect(Collectors.joining(" & "));
        if (mirror instanceof TypeVariable || mirror.getKind().isPrimitive() || mirror.getKind() == TypeKind.VOID) return rawName(mirror, flat);
        throw new IllegalArgumentException("Unsupported type kind: " + mirror.getKind());
    }

    private static String json(Object value) {
        if (value == null) return "null";
        if (value instanceof Map<?, ?> map) return map.entrySet().stream().sorted(Comparator.comparing(e -> e.getKey().toString())).map(e -> escape(e.getKey().toString()) + ":" + json(e.getValue())).collect(Collectors.joining(",", "{", "}"));
        if (value instanceof Collection<?> collection) return collection.stream().map(JsonDoclet::json).collect(Collectors.joining(",", "[", "]"));
        if (value instanceof Boolean) return value.toString();
        if (value instanceof Number number) {
            if (number instanceof Double d && !Double.isFinite(d) || number instanceof Float f && !Float.isFinite(f)) return "null";
            return number.toString();
        }
        return escape(value.toString());
    }

    private static String escape(String text) {
        var result = new StringBuilder("\"");
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            switch (c) {
                case '"' -> result.append("\\\"");
                case '\\' -> result.append("\\\\");
                case '\n' -> result.append("\\n");
                case '\r' -> result.append("\\r");
                case '\t' -> result.append("\\t");
                default -> {
                    if (c < 32) result.append(String.format("\\u%04x", (int) c));
                    else result.append(c);
                }
            }
        }
        return result.append('"').toString();
    }
}
